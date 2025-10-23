/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // Disable static page generation for pages with wallet context
  experimental: {
    appDir: true,
  },
  
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
  
  // Export only specific routes, skip error pages with wallet context
  exportPathMap: async function (
    defaultPathMap,
    { dev, dir, outDir, distDir, buildId }
  ) {
    return {
      '/': { page: '/' },
      '/vpn': { page: '/vpn' },
    };
  },
};

module.exports = nextConfig;


