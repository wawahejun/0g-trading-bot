import { Chain } from 'viem';

export const zgTestnet = {
    id: 16602,
    name: '0G Galileo Testnet',
    nativeCurrency: {
        decimals: 18,
        name: 'A0GI',
        symbol: 'A0GI',
    },
    rpcUrls: {
        default: {
            http: ['https://evmrpc-testnet.0g.ai'],
        },
        public: {
            http: ['https://evmrpc-testnet.0g.ai'],
        },
    },
    blockExplorers: {
        default: {
            name: '0G Explorer',
            url: 'https://chainscan-galileo.0g.ai',
        },
    },
    testnet: true,
} as const satisfies Chain;
