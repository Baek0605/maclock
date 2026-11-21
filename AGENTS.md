<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- 위 블록은 `next dev`가 자동으로 다시 만들기 때문에 영어 그대로 둔다. (요약: 이 Next.js 버전은 예전과 다를 수 있으니, 코드를 쓰기 전에 node_modules/next/dist/docs/ 안의 문서를 먼저 확인하라는 뜻) -->

# MacLock 프로젝트 안내 (AI 코딩 도구용)

이 프로젝트에서 코드를 쓸 때 아래를 지킨다. 자세한 내용은 `README.md`와 `docs/개발계획.md`를 본다.

## 무엇을 만드나
공개 GitHub 저장소의 커밋·PR·이슈를 가져와, 자연어 질문에 관련 기록을 찾아 **근거 링크와 함께** 답하는 서비스.

## 반드시 지킬 것
- API 키(OpenAI, GitHub, Supabase)는 환경 변수로만 읽는다. 코드에 직접 쓰지 않는다.
- OpenAI 호출은 서버 쪽 API Route(`app/api/...`)에서만 한다. 클라이언트 컴포넌트에서 부르지 않는다.
- AI 답변의 근거 번호를 링크로 바꾸는 일은 코드가 한다. AI가 링크를 직접 만들게 하지 않는다.
- AI에게 보내기 전에 기록을 마스킹한다. (`lib/masking.ts`)
- 답이 딱 정해진 일(가져오기, 정리, 마스킹, 링크 변환)은 코드로, 판단이 필요한 일(검색, 요약)만 AI로 한다.

## 작업 방식
- 화면을 만들 때는 가짜 응답으로 먼저 개발하고, 실제 API 호출은 AI 기능을 시험할 때만 한다. (예산 $40)
- 모델은 임베딩 `text-embedding-3-small`, 답변은 mini급 모델을 쓴다.
- 코드 주석과 화면 문구는 한국어로 쓴다.
