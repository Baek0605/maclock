import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// 기본 글꼴 (영문·숫자용). 한글은 시스템 글꼴로 표시된다.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 브라우저 탭 제목과 검색 결과 설명
export const metadata: Metadata = {
  title: "MacLock",
  description: "개발팀의 과거를 검색 가능한 지식으로. 커밋·PR·이슈에서 맥락을 찾아 근거와 함께 답합니다.",
};

// 모든 페이지를 감싸는 공통 틀
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
