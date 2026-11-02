/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 사진 변환 모듈은 번들하지 않고 서버에서 그대로 사용
  serverExternalPackages: ['sharp', 'heic-convert'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'plant-doctor-app.vercel.app',
      },
    ],
  },
  env: {
    CUSTOM_API_URL: process.env.CUSTOM_API_URL,
  },
};

module.exports = nextConfig;