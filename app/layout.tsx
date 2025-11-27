import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import '@rainbow-me/rainbowkit/styles.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: '0G Broker Starter Kit',
    description: '去中心化 AI 应用示例 - 使用 0G Serving Broker',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="zh-CN">
            <body className={inter.className}>
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
