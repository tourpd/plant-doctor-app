/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 진단 근거 자료(전문가 상담 사례 색인)를 진단 서버에 함께 싣기
  outputFileTracingIncludes: {
    '/api/vision': ['./app/data/knowledge/**/*'],
  },
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