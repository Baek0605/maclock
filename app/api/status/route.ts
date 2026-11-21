import { connection } from "next/server";

// 화면 위쪽 표시용: AI 키와 GitHub 토큰이 설정되어 있는지 (값은 절대 돌려주지 않는다)
export async function GET() {
  await connection(); // 빌드 때 고정하지 않고 요청 때마다 확인
  return Response.json({
    ai: Boolean(process.env.OPENAI_API_KEY),
    mock: process.env.MOCK_AI === "1", // 가상 AI 모드 (OpenAI를 부르지 않음)
    github: Boolean(process.env.GITHUB_TOKEN),
  });
}
