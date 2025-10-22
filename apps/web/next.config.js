/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Silence optional pretty printer resolution warnings from pino
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    config.resolve.alias['pino-pretty'] = false;
    return config;
  },
};

module.exports = nextConfig;


