'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    chatId?: string;
    verified?: boolean;
}

interface ChatInterfaceProps {
    broker: any;
}

export default function ChatInterface({ broker }: ChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [providerAddress, setProviderAddress] = useState('');
    const [model, setModel] = useState('meta-llama/Llama-3.2-3B-Instruct');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const sendMessage = async () => {
        if (!broker || !input.trim() || !providerAddress) return;

        const userMessage: Message = { role: 'user', content: input };
        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        setError(null);

        try {
            // Get service metadata for endpoint
            const metadata = await broker.inference.getServiceMetadata(providerAddress);
            const endpoint = metadata.url;

            // Prepare messages for API
            const apiMessages = [...messages, userMessage].map((msg) => ({
                role: msg.role,
                content: msg.content,
            }));

            // Get request headers with authentication
            const headers = await broker.inference.getRequestHeaders(
                providerAddress,
                JSON.stringify(apiMessages)
            );

            // Make request to AI service
            const response = await fetch(`${endpoint}/chat/completions`, {
                method: 'POST',
                headers: {
                    ...headers,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: apiMessages,
                    model,
                    stream: true,
                }),
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.statusText}`);
            }

            // Handle streaming response
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let assistantMessage = '';
            let chatId = '';

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data === '[DONE]') continue;

                            try {
                                const parsed = JSON.parse(data);

                                // Extract chat ID
                                if (parsed.id && !chatId) {
                                    chatId = parsed.id;
                                }

                                // Extract content
                                const content = parsed.choices?.[0]?.delta?.content;
                                if (content) {
                                    assistantMessage += content;

                                    // Update message in real-time
                                    setMessages((prev) => {
                                        const newMessages = [...prev];
                                        const lastMessage = newMessages[newMessages.length - 1];

                                        if (lastMessage?.role === 'assistant') {
                                            lastMessage.content = assistantMessage;
                                            lastMessage.chatId = chatId;
                                        } else {
                                            newMessages.push({
                                                role: 'assistant',
                                                content: assistantMessage,
                                                chatId,
                                            });
                                        }

                                        return newMessages;
                                    });
                                }
                            } catch (e) {
                                // Skip invalid JSON
                            }
                        }
                    }
                }
            }
        } catch (err) {
            console.error('Failed to send message:', err);
            setError(err instanceof Error ? err.message : 'Failed to send message');
        } finally {
            setIsLoading(false);
        }
    };

    const verifyContent = async (messageIndex: number) => {
        const message = messages[messageIndex];
        if (!broker || !message.chatId || message.role !== 'assistant') return;

        try {
            const isValid = await broker.inference.processResponse(
                providerAddress,
                message.content,
                message.chatId
            );

            setMessages((prev) => {
                const newMessages = [...prev];
                newMessages[messageIndex] = { ...newMessages[messageIndex], verified: isValid };
                return newMessages;
            });
        } catch (err) {
            console.error('Failed to verify content:', err);
            setError('Failed to verify content');
        }
    };

    return (
        <div className="space-y-6">
            {/* Configuration Card */}
            <div className="glass rounded-lg p-6 space-y-4">
                <h3 className="text-xl font-semibold">配置</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            提供者地址
                        </label>
                        <input
                            type="text"
                            value={providerAddress}
                            onChange={(e) => setProviderAddress(e.target.value)}
                            placeholder="输入服务提供者地址"
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono text-sm"
                            disabled={isLoading}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">
                            模型
                        </label>
                        <input
                            type="text"
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            placeholder="模型名称"
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono text-sm"
                            disabled={isLoading}
                        />
                    </div>
                </div>
            </div>

            {/* Chat Messages Card */}
            <div className="glass rounded-lg p-6 space-y-4">
                <h3 className="text-xl font-semibold">对话</h3>

                {/* Messages Container */}
                <div className="h-[400px] overflow-y-auto space-y-4 p-4 bg-white/5 rounded-lg">
                    {messages.length === 0 && (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                            开始与 AI 对话
                        </div>
                    )}

                    {messages.map((message, index) => (
                        <div
                            key={index}
                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[80%] p-4 rounded-lg ${message.role === 'user'
                                        ? 'bg-primary/20 text-primary-foreground'
                                        : 'bg-white/10'
                                    }`}
                            >
                                <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>

                                {message.role === 'assistant' && message.chatId && (
                                    <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                                        <button
                                            onClick={() => verifyContent(index)}
                                            className="text-xs px-3 py-1 bg-white/5 hover:bg-white/10 rounded transition-colors"
                                            disabled={message.verified !== undefined}
                                        >
                                            {message.verified === undefined ? '验证内容' : message.verified ? '✓ 已验证' : '✗ 验证失败'}
                                        </button>
                                        <span className="text-xs text-muted-foreground font-mono">
                                            ID: {message.chatId.slice(0, 8)}...
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="space-y-4">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                sendMessage();
                            }
                        }}
                        placeholder="输入消息... (Shift+Enter 换行)"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
                        rows={3}
                        disabled={isLoading}
                    />

                    <button
                        onClick={sendMessage}
                        disabled={!broker || !input.trim() || !providerAddress || isLoading}
                        className="w-full px-6 py-3 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-primary/25"
                    >
                        {isLoading ? '发送中...' : '发送消息'}
                    </button>
                </div>

                {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <p className="text-red-400 text-sm">{error}</p>
                    </div>
                )}
            </div>

            {!broker && (
                <div className="glass rounded-lg p-6 text-center">
                    <p className="text-muted-foreground">请先连接钱包以使用聊天功能</p>
                </div>
            )}
        </div>
    );
}
