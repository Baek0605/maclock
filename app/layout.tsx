import type { Metadata } from "next";
import "./globals.css";

// 글꼴은 maclock.css에서 시스템 글꼴(맑은 고딕 등)로 지정한다.
// (기본 템플릿의 Google 글꼴은 쓰지 않아 뺐다)

// 브라우저 탭 제목과 검색 결과 설명
export const metadata: Metadata = {
  title: "MacLock",
  description: "개발팀의 과거를 검색 가능한 지식으로. 커밋·PR·이슈에서 맥락을 찾아 근거와 함께 답합니다.",
};

// 모든 페이지를 감싸는 공통 틀
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
