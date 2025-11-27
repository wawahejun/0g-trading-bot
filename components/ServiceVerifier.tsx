'use client';

import { useState, useEffect } from 'react';

interface ServiceVerifierProps {
    broker: any;
    selectedService?: string;
    onServiceSelect?: (service: string) => void;
}

export default function ServiceVerifier({ broker, selectedService, onServiceSelect }: ServiceVerifierProps) {
    const [providerAddress, setProviderAddress] = useState(selectedService || '');
    const [metadata, setMetadata] = useState<any>(null);
    const [isAcknowledged, setIsAcknowledged] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [services, setServices] = useState<any[]>([]);
    const [isFetchingServices, setIsFetchingServices] = useState(false);

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
            console.log('Raw service list:', list);

            // Test each service and filter out invalid ones
            const validServices = [];
            for (const s of list) {
                const address = s.provider || "";
                if (!address) continue;

                try {
                    // Try to get metadata to validate the service
                    const metadata = await broker.inference.getServiceMetadata(address);
                    if (metadata && metadata.model) {
                        validServices.push({
                            address: address,
                            name: s.name || metadata.model || "Unknown",
                            model: metadata.model || s.model || "Unknown",
                        });
                        console.log('✅ Valid service:', address, metadata.model);
                    }
                } catch (err) {
                    console.warn('⚠️ Skipping invalid service:', address, err);
                    // Skip invalid services
                }
            }

            console.log(`Found ${validServices.length} valid services out of ${list.length} total`);
            setServices(validServices);

            // If we have services and no provider selected, select the first one
            if (validServices.length > 0 && !providerAddress) {
                const firstAddress = validServices[0].address;
                handleServiceSelect(firstAddress);
            }
        } catch (err) {
            console.error('Failed to fetch services:', err);
            setError('获取服务列表失败。请检查网络连接并重试。');
        } finally {
            setIsFetchingServices(false);
        }
    };

    useEffect(() => {
        if (broker) {
            fetchServices();
        }
    }, [broker]);

    const fetchMetadata = async () => {
        if (!broker || !providerAddress) return;

        try {
            setIsLoading(true);
            setError(null);

            console.log('Fetching metadata for provider:', providerAddress);
            const serviceMetadata = await broker.inference.getServiceMetadata(providerAddress);
            console.log('Service metadata:', serviceMetadata);
            setMetadata(serviceMetadata);

            // Check if already acknowledged (this might fail for invalid addresses)
            try {
                const acknowledged = await broker.inference.userAcknowledged(providerAddress);
                console.log('Already acknowledged:', acknowledged);
                setIsAcknowledged(acknowledged);
            } catch (ackErr) {
                console.warn('Could not check acknowledgement status:', ackErr);
                setIsAcknowledged(false);
            }
        } catch (err) {
            console.error('Failed to fetch metadata:', err);

            let errorMessage = err instanceof Error ? err.message : 'Failed to fetch service metadata';

            if (errorMessage.includes('missing revert data')) {
                errorMessage = '无法获取该服务信息。可能原因：\n' +
                    '1. 该服务地址无效或已下线\n' +
                    '2. 该服务提供商已停止服务\n\n' +
                    '请尝试选择其他可用的服务。';
            }

            setError(errorMessage);
            setMetadata(null);
        } finally {
            setIsLoading(false);
        }
    };

    const acknowledgeService = async () => {
        if (!broker || !providerAddress) return;

        try {
            setIsLoading(true);
            setError(null);

            console.log('Acknowledging provider:', providerAddress);

            // Use the correct SDK method that triggers wallet signature
            await broker.inference.acknowledgeProviderSigner(providerAddress);

            console.log('Provider acknowledged successfully');
            setIsAcknowledged(true);

            // Refresh metadata to confirm
            await fetchMetadata();
        } catch (err) {
            console.error('Failed to acknowledge service:', err);

            let errorMessage = err instanceof Error ? err.message : 'Failed to acknowledge service';

            if (errorMessage.includes('user rejected')) {
                errorMessage = '您拒绝了交易签名。验证服务需要您在钱包中确认交易。';
            } else if (errorMessage.includes('missing revert data')) {
                errorMessage = '验证失败。该服务地址可能无效或已下线，请选择其他服务。';
            }

            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Provider Input Card */}
            <div className="glass rounded-lg p-6 space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-semibold">服务提供者</h3>
                    <button
                        onClick={fetchServices}
                        disabled={isFetchingServices || !broker}
                        className="text-xs px-2 py-1 bg-white/10 hover:bg-white/20 rounded transition-colors"
                    >
                        {isFetchingServices ? '刷新中...' : '刷新列表'}
                    </button>
                </div>

                <div className="space-y-4">
                    {services.length > 0 && (
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
                                        {s.name} - {s.model}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-muted-foreground mt-2">
                                💡 如果某个服务显示错误，请尝试其他服务
                            </p>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium mb-2">
                            提供者地址
                        </label>
                        <input
                            type="text"
                            value={providerAddress}
                            onChange={(e) => handleServiceSelect(e.target.value)}
                            placeholder="输入服务提供者的地址"
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono text-sm"
                            disabled={isLoading}
                        />
                    </div>

                    <button
                        onClick={fetchMetadata}
                        disabled={!broker || !providerAddress || isLoading}
                        className="w-full px-6 py-3 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-primary/25"
                    >
                        {isLoading ? '加载中...' : '获取服务信息'}
                    </button>
                </div>

                {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <p className="text-red-400 text-sm">{error}</p>
                    </div>
                )}
            </div>

            {/* Service Metadata Card */}
            {metadata && (
                <div className="glass rounded-lg p-6 space-y-4 animate-fade-in">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-semibold">服务详情</h3>
                        {isAcknowledged && (
                            <span className="px-3 py-1 bg-green-500/20 text-green-400 text-sm rounded-full border border-green-500/30">
                                ✓ 已验证
                            </span>
                        )}
                    </div>

                    <div className="space-y-3">
                        <div className="bg-white/5 rounded-lg p-4">
                            <p className="text-sm text-muted-foreground mb-1">服务名称</p>
                            <p className="font-medium">{metadata.name || 'N/A'}</p>
                        </div>

                        <div className="bg-white/5 rounded-lg p-4">
                            <p className="text-sm text-muted-foreground mb-1">模型</p>
                            <p className="font-medium font-mono text-sm">{metadata.model || 'N/A'}</p>
                        </div>

                        <div className="bg-white/5 rounded-lg p-4">
                            <p className="text-sm text-muted-foreground mb-1">服务端点</p>
                            <p className="font-mono text-sm break-all">{metadata.endpoint || metadata.url || 'N/A'}</p>
                        </div>

                        <div className="bg-white/5 rounded-lg p-4">
                            <p className="text-sm text-muted-foreground mb-1">提供者地址</p>
                            <p className="font-mono text-sm break-all">{providerAddress}</p>
                        </div>
                    </div>

                    {!isAcknowledged && (
                        <div className="space-y-3">
                            <button
                                onClick={acknowledgeService}
                                disabled={isLoading}
                                className="w-full px-6 py-3 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-primary/25"
                            >
                                {isLoading ? '验证中...' : '验证服务（会弹出钱包签名）'}
                            </button>
                            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                                <p className="text-sm text-yellow-400">
                                    ⚠️ 重要：点击"验证服务"后会弹出 MetaMask 签名请求，<strong>请务必确认交易</strong>。如果没有弹出，请检查：
                                    <br />1. 该服务地址是否有效（是否有显示服务详情）
                                    <br />2. 是否有其他 MetaMask 弹窗被隐藏
                                    <br />3. 尝试刷新页面后重试
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {!broker && (
                <div className="glass rounded-lg p-6 text-center">
                    <p className="text-muted-foreground">请先连接钱包以验证服务</p>
                </div>
            )}
        </div>
    );
}
