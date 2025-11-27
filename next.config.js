/** @type {import('next').NextConfig} */
const nextConfig = {
    webpack: (config, { isServer }) => {
        // Add fallbacks for Node.js modules
        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                'node:crypto': false,
                crypto: false,
                fs: false,
                'fs/promises': false,
                child_process: false,
                net: false,
                tls: false,
                readline: false,
                os: false,
                path: false,
                '@react-native-async-storage/async-storage': false,
            };
        }

        config.externals.push('pino-pretty', 'lokijs', 'encoding');
        return config;
    },
};

module.exports = nextConfig;
