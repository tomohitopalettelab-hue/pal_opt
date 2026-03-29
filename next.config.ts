import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/',
        destination: '/main',
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOW-FROM https://console.palette-lab.com' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self' https://console.palette-lab.com" },
        ],
      },
    ];
  },
};
export default nextConfig;
