'use client';

import { useState } from 'react';

interface ServiceVerifierProps {
    broker: any;
}

export default function ServiceVerifier({ broker }: ServiceVerifierProps) {
    const [providerAddress, setProviderAddress] = useState('');
    const [metadata, setMetadata] = useState<any>(null);
    const [isAcknowledged, setIsAcknowledged] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchMetadata = async () => {
        if (!broker || !providerAddress) return;

        try {
            setIsLoading(true);
            setError(null);

            const serviceMetadata = await broker.inference.getServiceMetadata(providerAddress);
            setMetadata(serviceMetadata);

            // Check if already acknowledged
            const acknowledged = await broker.inference.userAcknowledged(providerAddress);
            setIsAcknowledged(acknowledged);
        } catch (err) {
            console.error('Failed to fetch metadata:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch service metadata');
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

            await broker.inference.acknowledge(providerAddress);
            setIsAcknowledged(true);
        } catch (err) {
            console.error('Failed to acknowledge service:', err);
            setError(err instanceof Error ? err.message : 'Failed to acknowledge service');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Provider Input Card */}
            <div className="glass rounded-lg p-6 space-y-4">
                <h3 className="text-xl font-semibold">服务提供者</h3>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            提供者地址
                        </label>
                        <input
                            type="text"
                            value={providerAddress}
                            onChange={(e) => setProviderAddress(e.target.value)}
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
                            <p className="font-mono text-sm break-all">{metadata.url || 'N/A'}</p>
                        </div>

                        <div className="bg-white/5 rounded-lg p-4">
                            <p className="text-sm text-muted-foreground mb-1">提供者地址</p>
                            <p className="font-mono text-sm break-all">{providerAddress}</p>
                        </div>
                    </div>

                    {!isAcknowledged && (
                        <button
                            onClick={acknowledgeService}
                            disabled={isLoading}
                            className="w-full px-6 py-3 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-primary/25"
                        >
                            {isLoading ? '验证中...' : '验证服务'}
                        </button>
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
