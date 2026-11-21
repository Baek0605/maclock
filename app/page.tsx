// MacLock 첫 화면 (임시)
// 저장소 연결 → 질문 → 답변 화면은 1주 차에 이 파일에서 만든다.
export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col gap-8 px-8 py-24">
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-semibold tracking-tight text-black dark:text-zinc-50">
            MacLock
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            개발팀의 과거를 검색 가능한 지식으로.
          </p>
        </div>

        <p className="leading-7 text-zinc-700 dark:text-zinc-300">
          GitHub 저장소를 연결하고 &ldquo;예전에 이거 왜 바꿨지?&rdquo;를 물으면,
          관련 커밋·PR·이슈를 찾아 근거 링크와 함께 답해 드립니다.
        </p>

        <ol className="flex flex-col gap-2 text-zinc-700 dark:text-zinc-300">
          <li>1. 공개 GitHub 저장소 주소를 입력합니다.</li>
          <li>2. 궁금한 점을 질문합니다. 에러 로그를 붙여넣어도 됩니다.</li>
          <li>3. 답변과 근거 링크를 확인합니다.</li>
        </ol>

        <p className="text-sm text-zinc-500">
          준비 중입니다. 코드는 남지만, 맥락은 남지 않는다.
        </p>
      </main>
    </div>
  );
}
