/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  webpack: (config, { isServer }) => {
    // Silence optional pretty printer resolution warnings from pino
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    config.resolve.alias['pino-pretty'] = false;
    
    // Handle solana wallet adapter on server side
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }
    
    return config;
  },
};

module.exports = nextConfig;


