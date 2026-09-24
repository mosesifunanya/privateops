/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    resolveAlias: {
      'isomorphic-ws': './src/shims/isomorphic-ws.ts',
    },
  },
};

export default nextConfig;