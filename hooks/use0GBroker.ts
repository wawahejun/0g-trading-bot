'use client';

import { useEffect, useState } from 'react';
import { useWalletClient } from 'wagmi';
import { BrowserProvider } from 'ethers';
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker';

export function use0GBroker() {
    const { data: walletClient } = useWalletClient();
    const [broker, setBroker] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refreshCounter, setRefreshCounter] = useState(0);

    useEffect(() => {
        async function initBroker() {
            if (!walletClient) {
                setBroker(null);
                return;
            }

            try {
                setIsLoading(true);
                setError(null);

                console.log('========== BROKER INITIALIZATION START ==========');
                console.log('Wallet client:', walletClient);
                console.log('Refresh counter:', refreshCounter);

                // Convert viem wallet client to ethers provider and signer
                // @ts-ignore - viem wallet client can be used as ethereum provider  
                const ethersProvider = new BrowserProvider(walletClient);
                const signer = await ethersProvider.getSigner();

                console.log('Ethers signer:', signer);
                console.log('Signer address:', await signer.getAddress());

                // Use LEGACY Newton testnet contracts where user's ledger exists
                // These are the default contracts in SDK 0.5.4
                const legacyLedgerCA = '0x09D00A2B31067da09bf0e873E58746d1285174Cc';
                const legacyInferenceCA = '0x4f850eb2abc036096999882b54e92ecd63aec13d';
                const legacyFineTuningCA = '0x677AB02CA1DAffEf7521858d3264E4574BEf7aA7';
                const gasPrice = 10000000000; // 10 Gwei

                console.log('Using legacy contracts:');
                console.log('  Ledger:', legacyLedgerCA);
                console.log('  Inference:', legacyInferenceCA);
                console.log('  FineTuning:', legacyFineTuningCA);
                console.log('  Gas Price:', gasPrice);

                // Create broker instance
                const brokerInstance = await createZGComputeNetworkBroker(
                    signer,
                    legacyLedgerCA,
                    legacyInferenceCA,
                    legacyFineTuningCA,
                    gasPrice
                );

                console.log('Broker instance created:', brokerInstance);
                console.log('========== BROKER INITIALIZATION SUCCESS ==========');
                setBroker(brokerInstance);
            } catch (err) {
                console.error('========== BROKER INITIALIZATION ERROR ==========');
                console.error('Error:', err);
                console.error('Error message:', err instanceof Error ? err.message : 'Unknown error');
                console.error('Error stack:', err instanceof Error ? err.stack : undefined);
                setError(err instanceof Error ? err.message : 'Failed to initialize broker');
                setBroker(null);
            } finally {
                setIsLoading(false);
            }
        }

        initBroker();
    }, [walletClient, refreshCounter]);

    const refreshBroker = () => {
        console.log('Manual broker refresh triggered');
        setRefreshCounter(prev => prev + 1);
    };

    return {
        broker,
        isLoading,
        error,
        isConnected: !!broker,
        refreshBroker,
    };
}
