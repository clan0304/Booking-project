import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverActions: {
    bodySizeLimit: '10mb', // Increase to 10MB to safely handle 5MB photos
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/**',
      },
    ],
  },
};

export default nextConfig;
