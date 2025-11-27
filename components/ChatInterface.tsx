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
    selectedService?: string;
    onServiceSelect?: (service: string) => void;
}

export default function ChatInterface({ broker, selectedService, onServiceSelect }: ChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [providerAddress, setProviderAddress] = useState(selectedService || '');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [services, setServices] = useState<any[]>([]);
    const [isFetchingServices, setIsFetchingServices] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Sync local state with prop when prop changes
    useEffect(() => {
        if (selectedService !== undefined) {
            setProviderAddress(selectedService);
        }
    }, [selectedService]);

    const handleServiceSelect = (address: string) => {
        setProviderAddress(address);
        if (onServiceSelect) {
            onServiceSelect(address);
        }
    };

    const fetchServices = async () => {
        if (!broker) return;

        try {
            setIsFetchingServices(true);
            console.log('Fetching service list...');
            const list = await broker.inference.listService();

            // Test each service and filter out invalid ones
            const validServices = [];
            for (const s of list) {
                const address = s.provider || "";
                if (!address) continue;

                try {
                    const metadata = await broker.inference.getServiceMetadata(address);
                    if (metadata && metadata.model) {
                        validServices.push({
                            address: address,
                            name: s.name || metadata.model || "Unknown",
                            model: metadata.model || s.model || "Unknown",
                        });
                    }
                } catch (err) {
                    console.warn('Skipping invalid service:', address);
                }
            }

            console.log(`Found ${validServices.length} valid services`);
            setServices(validServices);

            // If we have services and no provider selected, select the first one
            if (validServices.length > 0 && !providerAddress) {
                const firstAddress = validServices[0].address;
                handleServiceSelect(firstAddress);
            }
        } catch (err) {
            console.error('Failed to fetch services:', err);
        } finally {
            setIsFetchingServices(false);
        }
    };

    useEffect(() => {
        if (broker) {
            fetchServices();
        }
    }, [broker]);

    const sendMessage = async () => {
        if (!broker || !input.trim() || !providerAddress) return;

        const userMessage: Message = { role: 'user', content: input };
        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        setError(null);

        try {
            // ==== Service Verification Check (CRITICAL!) ====
            // Before managing sub-accounts, we MUST verify the service is acknowledged
            console.log('===== SERVICE VERIFICATION CHECK =====');
            let isServiceAcknowledged = false;
            try {
                isServiceAcknowledged = await broker.inference.userAcknowledged(providerAddress);
                console.log('Service acknowledged status:', isServiceAcknowledged);
            } catch (ackErr) {
                console.error('Failed to check acknowledgement status:', ackErr);
            }

            if (!isServiceAcknowledged) {
                throw new Error('服务未验证！\n\n在使用服务前，您必须先验证服务。\n\n请按以下步骤操作：\n1. 前往"服务验证"页面\n2. 选择当前服务（' + providerAddress.substring(0, 10) + '...）\n3. 点击"获取服务信息"\n4. 点击"验证服务"按钮\n5. 在MetaMask中确认签名\n6. 验证成功后返回"Chat对话"页面重试');
            }
            console.log('✅ Service is verified, proceeding with sub-account management');

            // ==== Sub-account Management (based on compute-web-demo) ====
            // 0G uses a sub-account system: main ledger holds funds,
            // but each service requires a separate sub-account
            console.log('===== SUB-ACCOUNT MANAGEMENT START =====');

            // Step 1: Check if sub-account exists for this service
            let subAccount;
            try {
                subAccount = await broker.inference.getAccount(providerAddress);
                console.log('✅ Sub-account exists for service:', providerAddress);
                console.log('Sub-account balance:', subAccount.balance?.toString(), 'Wei');
                console.log('Sub-account balance (A0GI):', subAccount.balance ? (Number(subAccount.balance) / 1e18).toFixed(4) : '0');
            } catch (error) {
                console.log('⚠️ Sub-account does not exist, creating and funding...');
                console.log('Transferring 2 A0GI from main ledger to sub-account...');

                try {
                    // Use single-layer ledger for transferFund (as per compute-web-demo)
                    await broker.ledger.transferFund(
                        providerAddress,
                        "inference",
                        BigInt(5e17)  // Transfer 0.5 A0GI (enough for 1-2 conversations)
                    );
                    console.log('✅ Sub-account created and funded with 0.5 A0GI');

                    // Get the newly created account
                    subAccount = await broker.inference.getAccount(providerAddress);
                    console.log('New sub-account balance:', subAccount.balance?.toString(), 'Wei');
                } catch (transferErr) {
                    console.error('❌ Failed to create sub-account:', transferErr);
                    throw new Error('无法创建服务子账户。\n\n可能原因：\n1. 主账本余额不足（需要至少0.5 A0GI）\n2. 网络问题或合约调用失败\n\n请前往"账户管理"页面检查余额，然后点击"🔄 刷新连接"重试。');
                }
            }

            // Step 2: Check if sub-account has sufficient balance
            const minBalance = BigInt(2e17); // 0.2 A0GI threshold
            const topUpAmount = BigInt(5e17);   // Top up 0.5 A0GI

            if (subAccount && subAccount.balance <= minBalance) {
                console.log('⚠️ Sub-account balance low, topping up...');
                console.log('Current balance:', subAccount.balance.toString(), 'Wei');
                console.log('Threshold:', minBalance.toString(), 'Wei');
                console.log('Top-up amount:', topUpAmount.toString(), 'Wei (0.5 A0GI)');

                try {
                    await broker.ledger.transferFund(
                        providerAddress,
                        "inference",
                        topUpAmount
                    );
                    console.log('✅ Sub-account topped up with 0.5 A0GI');

                    // Refresh account info
                    subAccount = await broker.inference.getAccount(providerAddress);
                    console.log('New sub-account balance:', subAccount.balance?.toString(), 'Wei');
                } catch (transferErr) {
                    console.error('❌ Failed to top up sub-account:', transferErr);
                    throw new Error('子账户余额不足且充值失败。\n\n请前往"账户管理"页面检查主账本余额，然后点击"🔄 刷新连接"重试。');
                }
            }

            console.log('✅ Sub-account ready, balance:', subAccount?.balance?.toString(), 'Wei');
            console.log('===== SUB-ACCOUNT MANAGEMENT END =====');

            // Get service metadata for endpoint and model (using destructuring as per 0G docs)
            const metadata = await broker.inference.getServiceMetadata(providerAddress);

            console.log('Service metadata:', metadata); // Debug log

            // Destructure with fallback for backward compatibility
            const endpoint = metadata.endpoint || metadata.url;
            const model = metadata.model;

            if (!endpoint) {
                throw new Error('Service endpoint is not available. Please verify the service first in the Service Verifier tab.');
            }

            if (!model) {
                throw new Error('Service model is not available. Please verify the service first.');
            }

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

            console.log('Making request to:', `${endpoint}/chat/completions`); // Debug log

            // Make request to AI service (endpoint is already complete URL)
            const response = await fetch(`${endpoint}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...headers,
                },
                body: JSON.stringify({
                    messages: apiMessages,
                    model: model,
                    stream: true,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
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
            console.error('===== Failed to send message =====');
            console.error('Error:', err);
            console.error('Error details:', {
                message: err instanceof Error ? err.message : String(err),
                provider: providerAddress,
            });

            let errorMessage = err instanceof Error ? err.message : 'Failed to send message';

            // Provide more helpful error messages
            if (errorMessage.includes('insufficient balance')) {
                const match = errorMessage.match(/available balance of (\d+)/);
                const balance = match ? match[1] : '0';
                errorMessage = `账本余额不足！\n\n` +
                    `当前可用余额: ${balance} wei (约 ${(Number(balance) / 1e18).toFixed(6)} A0GI)\n` +
                    `需要费用: 约 0.4 A0GI\n\n` +
                    `解决方法:\n` +
                    `1. 前往"账户管理"页面充值\n` +
                    `2. 充值成功后，点击页面右上角的"🔄 刷新连接"按钮\n` +
                    `3. 等待几秒钟后余额会自动更新\n` +
                    `4. 返回"Chat对话"页面继续使用`;
            } else if (errorMessage.includes('missing revert data')) {
                errorMessage = `无法连接到该服务提供商。\n\n` +
                    `可能原因:\n` +
                    `1. 该服务已下线\n` +
                    `2. 服务地址无效\n` +
                    `3. 网络连接问题\n\n` +
                    `请尝试:\n` +
                    `1. 在"服务验证"或"Chat对话"页面点击"刷新列表"\n` +
                    `2. 选择另一个可用的服务`;
            }

            setError(errorMessage);
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
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-semibold">配置</h3>
                    <button
                        onClick={fetchServices}
                        disabled={isFetchingServices || !broker}
                        className="text-xs px-2 py-1 bg-white/10 hover:bg-white/20 rounded transition-colors"
                    >
                        {isFetchingServices ? '刷新中...' : '刷新列表'}
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            选择服务
                        </label>
                        <select
                            value={providerAddress}
                            onChange={(e) => handleServiceSelect(e.target.value)}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono text-sm text-white [&>option]:text-black"
                            disabled={isLoading}
                        >
                            <option value="">选择一个服务...</option>
                            {services.map((s) => (
                                <option key={s.address} value={s.address}>
                                    {s.name} ({s.model})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">
                            提供者地址
                        </label>
                        <input
                            type="text"
                            value={providerAddress}
                            onChange={(e) => handleServiceSelect(e.target.value)}
                            placeholder="输入服务提供者地址"
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
