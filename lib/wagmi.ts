'use client';

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { zgTestnet } from './chains';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

export const config = getDefaultConfig({
    appName: '0G Broker Starter Kit',
    projectId,
    chains: [zgTestnet],
    ssr: true,
});
