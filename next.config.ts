import type { NextConfig } from "next";

// Next.js 설정 (create-next-app 기본값)
const nextConfig: NextConfig = {
  // 실험 기능: AI 코딩 도구용 피드백
  experimental: {
    agentFeedback: true,
  },
  // 최신 캐싱 방식. 캐시나 Suspense 관련 에러가 나면 이 설정을 먼저 의심할 것
  cacheComponents: true,
  partialPrefetching: true,
  // Tailwind CSS 처리 규칙
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
