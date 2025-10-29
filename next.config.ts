// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // Increase to 10MB to safely handle 5MB photos
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/**',
      },
      // Clerk user profile images (proxied images from OAuth providers)
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
      },
      // Clerk OAuth provider images (Google, GitHub, etc. profile pictures)
      {
        protocol: 'https',
        hostname: 'images.clerk.dev',
      },
    ],
  },
};

export default nextConfig;
