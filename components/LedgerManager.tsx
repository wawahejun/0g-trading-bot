'use client';

import { useState } from 'react';
import { parseEther, formatEther } from 'viem';
import { useAccount, useBalance } from 'wagmi';

interface LedgerManagerProps {
    broker: any;
}

export default function LedgerManager({ broker }: LedgerManagerProps) {
    const { address } = useAccount();
    const { data: walletBalance } = useBalance({ address });
    const [amount, setAmount] = useState('');
    const [ledgerInfo, setLedgerInfo] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchLedgerInfo = async () => {
        if (!broker) {
            console.log('No broker instance available');
            return;
        }

        try {
            setIsLoading(true);
            setError(null);
            console.log('========== fetchLedgerInfo START ==========');
            console.log('Fetching ledger info...');
            console.log('Broker instance:', broker);
            console.log('Broker ledger:', broker.ledger);
            console.log('Current wallet address:', address);

            // SDK 0.5.4 uses getLedger()
            const result = await broker.ledger.getLedger();
            console.log('Ledger query result:', result);

            if (result && result.totalBalance !== undefined) {
                console.log('✅ Ledger found!');
                console.log('Total balance:', result.totalBalance.toString());
                console.log('Available balance:', result.availableBalance.toString());

                setLedgerInfo({
                    balance: result.totalBalance,
                    address: address
                });
                setError(null);
            } else {
                console.warn('❌ No ledger found');
                setLedgerInfo(null);
                setError('未找到账本信息。');
            }
        } catch (err: any) {
            console.error('========== fetchLedgerInfo ERROR ==========');
            console.error('Error:', err);

            let errorMessage = err?.message || 'Failed to fetch ledger info';

            if (errorMessage.includes('missing revert data') ||
                errorMessage.includes('CALL_EXCEPTION')) {
                errorMessage = '未找到账本信息。';
            }

            setError(errorMessage);
            setLedgerInfo(null);
        } finally {
            setIsLoading(false);
            console.log('========== fetchLedgerInfo END ==========');
        }
    };

    const createLedger = async () => {
        if (!broker || !amount) return;

        try {
            setIsLoading(true);
            setError(null);
            console.log('Creating ledger with amount:', amount);
            console.log('Broker instance:', broker);

            // SDK expects amount in A0GI (number), not Wei (bigint)
            await broker.ledger.addLedger(Number(amount));
            console.log('Ledger created successfully');

            setAmount('');

            // Wait a bit for transaction to be confirmed
            console.log('Waiting for transaction confirmation...');
            await new Promise(resolve => setTimeout(resolve, 3000));

            await fetchLedgerInfo();
        } catch (err: any) {
            console.error('Failed to create ledger:', err);
            console.error('Error details:', {
                message: err?.message,
                code: err?.code,
                data: err?.data,
                transaction: err?.transaction,
            });

            // Provide more helpful error messages
            let errorMessage = err?.message || 'Failed to create ledger';

            if (errorMessage.includes('missing revert data') || errorMessage.includes('CALL_EXCEPTION')) {
                errorMessage = '创建账本失败。可能原因：\n' +
                    '1. 您已经创建了账本（请点击"刷新"查看，或点击"删除账本"后重试）\n' +
                    '2. 合约地址配置错误\n' +
                    '3. 参数格式不正确\n' +
                    '4. Gas不足\n' +
                    '请检查控制台查看详细错误信息';
            }

            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const deleteLedger = async () => {
        if (!broker) return;

        if (!confirm('确定要删除账本吗？这将删除您的账本信息，但不会退款。请先使用"取款"功能取回资金。')) {
            return;
        }

        try {
            setIsLoading(true);
            setError(null);
            console.log('Deleting ledger...');

            await broker.ledger.deleteLedger();
            console.log('Ledger deleted successfully');

            setLedgerInfo(null);
            await new Promise(resolve => setTimeout(resolve, 2000));
            await fetchLedgerInfo();
        } catch (err: any) {
            console.error('Failed to delete ledger:', err);
            setError(err?.message || 'Failed to delete ledger');
        } finally {
            setIsLoading(false);
        }
    };

    const depositFund = async () => {
        if (!broker || !amount) return;

        try {
            setIsLoading(true);
            setError(null);
            console.log('Depositing fund with amount:', amount);
            console.log('Broker instance:', broker);

            // SDK expects amount in A0GI (number), not Wei (bigint)
            await broker.ledger.depositFund(Number(amount));
            console.log('Deposit successful');

            setAmount('');

            // Wait a bit for transaction to be confirmed
            console.log('Waiting for transaction confirmation...');
            await new Promise(resolve => setTimeout(resolve, 3000));

            await fetchLedgerInfo();
        } catch (err: any) {
            console.error('Failed to deposit fund:', err);
            console.error('Error details:', {
                message: err?.message,
                code: err?.code,
                data: err?.data,
                transaction: err?.transaction,
            });

            // Provide more helpful error messages
            let errorMessage = err?.message || 'Failed to deposit fund';

            if (errorMessage.includes('missing revert data') || errorMessage.includes('CALL_EXCEPTION')) {
                errorMessage = '充值失败。可能原因：\n' +
                    '1. 您还没有创建账本（需要先创建账本才能充值）\n' +
                    '2. 合约地址配置错误\n' +
                    '3. 参数格式不正确\n' +
                    '4. Gas不足\n' +
                    '5. 您输入的金额超过了钱包余额\n' +
                    '请检查控制台查看详细错误信息';
            }

            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const withdrawFund = async () => {
        if (!broker || !amount) return;

        try {
            setIsLoading(true);
            setError(null);
            console.log('Withdrawing fund with amount:', amount);
            console.log('Broker instance:', broker);

            // SDK expects amount in A0GI (number), not Wei (bigint)
            await broker.ledger.refund(Number(amount));
            console.log('Withdraw (refund) successful');

            setAmount('');

            // Wait a bit for transaction to be confirmed
            console.log('Waiting for transaction confirmation...');
            await new Promise(resolve => setTimeout(resolve, 3000));

            await fetchLedgerInfo();
        } catch (err: any) {
            console.error('Failed to withdraw fund:', err);
            console.error('Error details:', {
                message: err?.message,
                code: err?.code,
                data: err?.data,
                transaction: err?.transaction,
            });

            // Provide more helpful error messages
            let errorMessage = err?.message || 'Failed to withdraw fund';

            if (errorMessage.includes('missing revert data') || errorMessage.includes('CALL_EXCEPTION')) {
                errorMessage = '取款失败。可能原因：\n' +
                    '1. 您还没有创建账本（需要先创建账本才能取款）\n' +
                    '2. 取款金额超过了可用余额\n' +
                    '3. 合约地址配置错误\n' +
                    '4. 参数格式不正确\n' +
                    '5. Gas不足\n' +
                    '请检查控制台查看详细错误信息';
            }

            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Ledger Info Card */}
            <div className="glass rounded-lg p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold">账本信息</h3>
                    <button
                        onClick={fetchLedgerInfo}
                        disabled={!broker || isLoading}
                        className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? '加载中...' : '刷新'}
                    </button>
                </div>

                {ledgerInfo && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white/5 rounded-lg p-4">
                            <p className="text-sm text-muted-foreground mb-1">账本余额</p>
                            <p className="text-2xl font-bold text-primary">
                                {ledgerInfo.balance ? formatEther(BigInt(ledgerInfo.balance.toString())) : '0'} A0GI
                            </p>
                        </div>
                        <div className="bg-white/5 rounded-lg p-4">
                            <p className="text-sm text-muted-foreground mb-1">账本地址</p>
                            <p className="text-sm font-mono truncate">
                                {ledgerInfo.address}
                            </p>
                        </div>
                    </div>
                )}

                {!ledgerInfo && !isLoading && (
                    <div className="text-center py-8 text-muted-foreground">
                        点击刷新按钮查询账本信息
                    </div>
                )}
            </div>

            {/* Wallet Balance Info */}
            <div className="glass rounded-lg p-4 flex justify-between items-center">
                <span className="text-sm text-muted-foreground">钱包余额</span>
                <span className="font-bold text-primary">
                    {walletBalance ? `${Number(walletBalance.formatted).toFixed(4)} ${walletBalance.symbol}` : 'Loading...'}
                </span>
            </div>

            {/* Actions Card */}
            <div className="glass rounded-lg p-6 space-y-4">
                <h3 className="text-xl font-semibold">账本操作</h3>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            充值金额 (A0GI)
                        </label>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="输入金额"
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                            disabled={isLoading}
                            step="0.01"
                            min="0"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <button
                            onClick={createLedger}
                            disabled={!broker || !amount || isLoading}
                            className="px-6 py-3 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-primary/25"
                        >
                            创建账本
                        </button>
                        <button
                            onClick={depositFund}
                            disabled={!broker || !amount || isLoading}
                            className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            充值
                        </button>
                        <button
                            onClick={withdrawFund}
                            disabled={!broker || !amount || isLoading}
                            className="px-6 py-3 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            取款
                        </button>
                        <button
                            onClick={deleteLedger}
                            disabled={!broker || isLoading}
                            className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            删除账本
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <p className="text-red-400 text-sm whitespace-pre-line">{error}</p>
                    </div>
                )}
            </div>

            {!broker && (
                <div className="glass rounded-lg p-6 text-center">
                    <p className="text-muted-foreground">请先连接钱包以使用账本功能</p>
                </div>
            )}
        </div>
    );
}
