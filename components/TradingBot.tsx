'use client';

import { useState, useEffect } from 'react';

interface TradingBotProps {
    broker: any;
    selectedService?: string;
    onServiceSelect?: (service: string) => void;
}

interface BinancePrice {
    symbol: string;
    price: string;
}

interface TradingAdvice {
    symbol: string;
    analysis: string;
    timestamp: string;
}

const POPULAR_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'];

export default function TradingBot({ broker, selectedService, onServiceSelect }: TradingBotProps) {
    const [prices, setPrices] = useState<BinancePrice[]>([]);
    const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
    const [advice, setAdvice] = useState<TradingAdvice | null>(null);
    const [isLoadingPrices, setIsLoadingPrices] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [providerAddress, setProviderAddress] = useState(selectedService || '');
    const [services, setServices] = useState<any[]>([]);

    // Fetch available services
    const fetchServices = async () => {
        if (!broker) return;

        try {
            const list = await broker.inference.listService();
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
                            model: metadata.model || "Unknown",
                        });
                    }
                } catch (err) {
                    console.warn('Skipping invalid service:', address);
                }
            }

            setServices(validServices);
            if (validServices.length > 0 && !providerAddress) {
                const firstAddress = validServices[0].address;
                setProviderAddress(firstAddress);
                if (onServiceSelect) {
                    onServiceSelect(firstAddress);
                }
            }
        } catch (err) {
            console.error('Failed to fetch services:', err);
        }
    };

    useEffect(() => {
        if (broker) {
            fetchServices();
        }
    }, [broker]);

    // Sync with parent component
    useEffect(() => {
        if (selectedService !== undefined) {
            setProviderAddress(selectedService);
        }
    }, [selectedService]);

    // Fetch Binance prices
    const fetchBinancePrices = async () => {
        setIsLoadingPrices(true);
        setError(null);

        try {
            const response = await fetch('https://fapi.binance.com/fapi/v1/ticker/price');
            if (!response.ok) {
                throw new Error('Failed to fetch Binance prices');
            }

            const allPrices: BinancePrice[] = await response.json();

            // Filter for popular symbols
            const filtered = allPrices.filter(p => POPULAR_SYMBOLS.includes(p.symbol));
            setPrices(filtered);
        } catch (err) {
            console.error('Failed to fetch prices:', err);
            setError('无法获取币安价格数据，请稍后重试');
        } finally {
            setIsLoadingPrices(false);
        }
    };

    // Get AI trading advice
    const getTradingAdvice = async () => {
        if (!broker || !providerAddress || !selectedSymbol) return;

        setIsAnalyzing(true);
        setError(null);

        try {
            // Check service verification
            let isServiceAcknowledged = false;
            try {
                isServiceAcknowledged = await broker.inference.userAcknowledged(providerAddress);
            } catch (ackErr) {
                console.error('Failed to check acknowledgement:', ackErr);
            }

            if (!isServiceAcknowledged) {
                throw new Error('服务未验证！请先前往"服务验证"页面验证服务。');
            }

            // Check/create sub-account
            let subAccount;
            try {
                subAccount = await broker.inference.getAccount(providerAddress);
            } catch (error) {
                await broker.ledger.transferFund(providerAddress, "inference", BigInt(5e17)); // 0.5 A0GI
                subAccount = await broker.inference.getAccount(providerAddress);
            }

            if (subAccount && subAccount.balance <= BigInt(2e17)) { // 0.2 A0GI threshold
                await broker.ledger.transferFund(providerAddress, "inference", BigInt(5e17)); // Top up 0.5 A0GI
            }

            // Get current price
            const currentPrice = prices.find(p => p.symbol === selectedSymbol);
            if (!currentPrice) {
                throw new Error('未找到该交易对的价格数据');
            }

            // Build trading analysis prompt (simplified to reduce cost)
            const userMessage = `作为加密货币分析师，分析${selectedSymbol}（当前价: $${currentPrice.price}）：
1. 趋势（涨/跌/震荡）
2. 建议（买/卖/观望）
3. 风险
4. 关键价位

简洁回答。`;

            const apiMessages = [{ role: 'user', content: userMessage }];

            const metadata = await broker.inference.getServiceMetadata(providerAddress);
            const endpoint = metadata.endpoint || metadata.url;
            const model = metadata.model;

            const headers = await broker.inference.getRequestHeaders(
                providerAddress,
                JSON.stringify(apiMessages)
            );

            console.log('Making trading bot request to:', `${endpoint}/chat/completions`);

            const response = await fetch(`${endpoint}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...headers,
                },
                body: JSON.stringify({
                    messages: apiMessages,
                    model: model,
                    stream: true,  // Use streaming like ChatInterface
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('AI service error:', errorText);
                throw new Error(`AI分析失败: ${response.statusText}`);
            }

            // Handle streaming response
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let fullAnalysis = '';

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
                                const content = parsed.choices[0]?.delta?.content || '';
                                fullAnalysis += content;
                            } catch (e) {
                                // Skip invalid JSON
                            }
                        }
                    }
                }
            }

            if (!fullAnalysis) {
                throw new Error('AI未返回分析内容');
            }

            console.log('Trading advice received, length:', fullAnalysis.length);

            setAdvice({
                symbol: selectedSymbol,
                analysis: fullAnalysis,
                timestamp: new Date().toLocaleString('zh-CN'),
            });
        } catch (err) {
            console.error('Failed to get trading advice:', err);
            setError(err instanceof Error ? err.message : '获取交易建议失败');
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Auto-fetch prices on mount
    useEffect(() => {
        fetchBinancePrices();
        const interval = setInterval(fetchBinancePrices, 10000); // Update every 10s
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="glass rounded-lg p-6">
                <h2 className="text-2xl font-bold mb-2">🤖 AI 交易助手</h2>
                <p className="text-sm text-muted-foreground">
                    基于0G去中心化AI，获取专业的加密货币交易分析
                </p>
            </div>

            {/* Service Selection */}
            <div className="glass rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-4">AI服务选择</h3>
                <select
                    value={providerAddress}
                    onChange={(e) => {
                        setProviderAddress(e.target.value);
                        if (onServiceSelect) {
                            onServiceSelect(e.target.value);
                        }
                    }}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono text-sm text-white [&>option]:text-black"
                    disabled={isAnalyzing}
                >
                    <option value="">选择AI服务...</option>
                    {services.map((s) => (
                        <option key={s.address} value={s.address}>
                            {s.name} ({s.model})
                        </option>
                    ))}
                </select>
            </div>

            {/* Price Display */}
            <div className="glass rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold">实时价格</h3>
                    <button
                        onClick={fetchBinancePrices}
                        disabled={isLoadingPrices}
                        className="text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded transition-colors"
                    >
                        {isLoadingPrices ? '刷新中...' : '🔄 刷新'}
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    {prices.map((price) => (
                        <button
                            key={price.symbol}
                            onClick={() => setSelectedSymbol(price.symbol)}
                            className={`p-4 rounded-lg border transition-all ${selectedSymbol === price.symbol
                                ? 'border-primary bg-primary/10'
                                : 'border-white/10 bg-white/5 hover:bg-white/10'
                                }`}
                        >
                            <div className="text-sm text-muted-foreground">
                                {price.symbol.replace('USDT', '/USDT')}
                            </div>
                            <div className="text-lg font-bold mt-1">
                                ${parseFloat(price.price).toLocaleString()}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Analysis Button */}
            <div className="glass rounded-lg p-6">
                <button
                    onClick={getTradingAdvice}
                    disabled={!broker || !providerAddress || isAnalyzing || !selectedSymbol}
                    className="w-full px-6 py-4 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-primary/25 text-lg"
                >
                    {isAnalyzing ? '🔍 AI分析中...' : `📊 获取 ${selectedSymbol.replace('USDT', '')} 交易建议`}
                </button>
            </div>

            {/* AI Advice Display */}
            {advice && (
                <div className="glass rounded-lg p-6 animate-fade-in">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold">AI 分析建议</h3>
                        <span className="text-xs text-muted-foreground">
                            {advice.timestamp}
                        </span>
                    </div>
                    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <div className="text-sm font-mono mb-2 text-primary">
                            {advice.symbol.replace('USDT', '/USDT')}
                        </div>
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">
                            {advice.analysis}
                        </div>
                    </div>
                    <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                        <p className="text-xs text-yellow-400">
                            ⚠️ <strong>风险提示</strong>：本建议仅供参考，不构成投资建议。加密货币交易存在高风险，请谨慎决策。
                        </p>
                    </div>
                </div>
            )}

            {/* Error Display */}
            {error && (
                <div className="glass rounded-lg p-6 bg-red-500/10 border-red-500/20">
                    <p className="text-red-400 text-sm">{error}</p>
                </div>
            )}

            {/* No Broker Warning */}
            {!broker && (
                <div className="glass rounded-lg p-6 text-center">
                    <p className="text-muted-foreground">请先连接钱包以使用交易助手</p>
                </div>
            )}
        </div>
    );
}
