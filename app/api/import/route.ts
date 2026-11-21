import { GitHubError, importRepo } from "@/lib/github";
import { MOCK_REPO, mockRepoDocs } from "@/lib/mockGithub";
import { mask } from "@/lib/masking";
import { allow, clientKey } from "@/lib/rateLimit";

// POST /api/import  { repo: "https://github.com/owner/repo" }
// GitHub에서 커밋·PR·이슈를 가져와 마스킹한 뒤 돌려준다.
export async function POST(req: Request) {
  if (!allow(`import:${clientKey(req)}`, 5)) {
    return Response.json({ error: "가져오기 요청이 너무 많습니다. 1분 뒤 다시 시도해 주세요." }, { status: 429 });
  }

  let repo = "";
  try {
    const body = (await req.json()) as { repo?: unknown };
    repo = typeof body.repo === "string" ? body.repo : "";
  } catch {
    return Response.json({ error: "요청 형식이 잘못되었습니다." }, { status: 400 });
  }
  if (!repo.trim()) return Response.json({ error: "저장소 주소를 입력해 주세요." }, { status: 400 });

  // 가상 저장소: 네트워크·토큰 없이 예시 기록을 돌려준다 (테스트용)
  if (repo.trim() === MOCK_REPO) {
    return Response.json({ repo: MOCK_REPO, docs: mockRepoDocs, masked: 0, mock: true });
  }

  try {
    const result = await importRepo(repo);
    let masked = 0;
    const docs = result.docs.map((d) => {
      const t = mask(d.title);
      const b = mask(d.body);
      masked += Object.values(t.counts).reduce((a, n) => a + n, 0) + Object.values(b.counts).reduce((a, n) => a + n, 0);
      return { ...d, title: t.text, body: b.text };
    });
    return Response.json({ repo: result.repo, docs, masked });
  } catch (e) {
    if (e instanceof GitHubError) return Response.json({ error: e.message }, { status: e.status });
    console.error("[import]", e);
    return Response.json({ error: "기록을 가져오는 중 오류가 났습니다." }, { status: 500 });
  }
}
