'use client';

import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { use0GBroker } from '@/hooks/use0GBroker';
import LedgerManager from '@/components/LedgerManager';
import ServiceVerifier from '@/components/ServiceVerifier';
import ChatInterface from '@/components/ChatInterface';

type Tab = 'ledger' | 'service' | 'chat';

export default function Home() {
    const [activeTab, setActiveTab] = useState<Tab>('ledger');
    const { broker, isLoading, error } = use0GBroker();

    const tabs = [
        { id: 'ledger' as Tab, label: '账户管理', icon: '💰' },
        { id: 'service' as Tab, label: '服务验证', icon: '✅' },
        { id: 'chat' as Tab, label: 'Chat 对话', icon: '💬' },
    ];

    return (
        <main className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
            {/* Header */}
            <header className="border-b border-white/10 glass">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-2xl">
                                🚀
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                                    0G Broker Starter Kit
                                </h1>
                                <p className="text-sm text-muted-foreground">去中心化 AI 应用示例</p>
                            </div>
                        </div>
                        <ConnectButton />
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="container mx-auto px-4 py-8">
                {/* Broker Status */}
                {isLoading && (
                    <div className="glass rounded-lg p-4 mb-6 animate-fade-in">
                        <p className="text-center text-muted-foreground">正在初始化 Broker...</p>
                    </div>
                )}

                {error && (
                    <div className="glass rounded-lg p-4 mb-6 bg-red-500/10 border-red-500/20 animate-fade-in">
                        <p className="text-center text-red-400">Broker 错误: {error}</p>
                    </div>
                )}

                {/* Tabs */}
                <div className="glass rounded-lg p-2 mb-6 inline-flex gap-2 animate-slide-up">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-6 py-3 rounded-lg font-medium transition-all ${activeTab === tab.id
                                    ? 'bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg shadow-primary/25'
                                    : 'hover:bg-white/5'
                                }`}
                        >
                            <span className="mr-2">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="animate-fade-in">
                    {activeTab === 'ledger' && <LedgerManager broker={broker} />}
                    {activeTab === 'service' && <ServiceVerifier broker={broker} />}
                    {activeTab === 'chat' && <ChatInterface broker={broker} />}
                </div>
            </div>

            {/* Footer */}
            <footer className="mt-16 border-t border-white/10 glass">
                <div className="container mx-auto px-4 py-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <p className="text-sm text-muted-foreground">
                            由 <span className="text-primary font-semibold">0G Labs</span> 提供支持
                        </p>
                        <div className="flex gap-4 text-sm">
                            <a
                                href="https://docs.0g.ai"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-primary transition-colors"
                            >
                                文档
                            </a>
                            <a
                                href="https://www.npmjs.com/package/@0glabs/0g-serving-broker"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-primary transition-colors"
                            >
                                NPM
                            </a>
                            <a
                                href="https://cloud.walletconnect.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-primary transition-colors"
                            >
                                WalletConnect
                            </a>
                        </div>
                    </div>
                </div>
            </footer>
        </main>
    );
}
