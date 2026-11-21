import type { HistoryDoc } from "./types";

// GitHub에서 커밋·PR·이슈 가져오기 (서버에서만 실행)
// 토큰(GITHUB_TOKEN)이 있으면 요청 한도가 넉넉하다. 없으면 시간당 약 60번이라 금방 찬다.

const API = "https://api.github.com";
const BODY_LIMIT = 2000; // 본문이 너무 길면 앞부분만

// "https://github.com/owner/repo", "github.com/owner/repo.git", "owner/repo" 모두 받기
export function parseRepo(input: string): { owner: string; repo: string } | null {
  const cleaned = input
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^github\.com\//, "")
    .replace(/\.git$/, "")
    .replace(/\/+$/, "");
  const m = cleaned.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

export class GitHubError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function gh<T>(path: string): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "maclock",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`${API}${path}`, { headers });
  if (res.status === 404) throw new GitHubError("저장소를 찾을 수 없습니다. 주소가 맞는지, 공개 저장소인지 확인해 주세요.", 404);
  if (res.status === 401) throw new GitHubError("GitHub 토큰이 올바르지 않습니다. .env.local의 GITHUB_TOKEN을 확인해 주세요.", 401);
  if (res.status === 403 || res.status === 429) {
    throw new GitHubError("GitHub 요청 한도를 넘었습니다. GITHUB_TOKEN을 설정했는지 확인하거나 잠시 후 다시 시도해 주세요.", 429);
  }
  if (!res.ok) throw new GitHubError(`GitHub 요청 실패 (${res.status})`, res.status);
  return (await res.json()) as T;
}

// 여러 페이지 가져오기 (페이지당 100개, 최대 maxItems개)
async function ghList<T>(path: string, maxItems: number): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; out.length < maxItems && page <= 5; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const items = await gh<T[]>(`${path}${sep}per_page=100&page=${page}`);
    out.push(...items);
    if (items.length < 100) break;
  }
  return out.slice(0, maxItems);
}

function shortDate(iso: string | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10); // 2026-11-21
}

function clip(text: string | null | undefined): string {
  const t = (text ?? "").trim();
  return t.length > BODY_LIMIT ? t.slice(0, BODY_LIMIT) + "\n…(이하 생략)" : t;
}

function firstLine(text: string): string {
  return text.split("\n")[0].slice(0, 120);
}

type GhCommit = {
  sha: string;
  html_url: string;
  commit: { message: string; author?: { name?: string; date?: string } };
  author?: { login?: string } | null;
};
type GhIssue = {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: string;
  created_at: string;
  closed_at: string | null;
  user?: { login?: string } | null;
  labels?: { name?: string }[];
  pull_request?: unknown; // 이슈 목록에 섞인 PR 표시
};
type GhPull = GhIssue & { merged_at: string | null };

export async function importRepo(input: string, maxEach = 150): Promise<{ repo: string; docs: HistoryDoc[] }> {
  const parsed = parseRepo(input);
  if (!parsed) throw new GitHubError("저장소 주소 형식이 아닙니다. 예: https://github.com/owner/repo", 400);
  const { owner, repo } = parsed;
  const full = `${owner}/${repo}`;
  const base = `/repos/${owner}/${repo}`;

  // 저장소가 있는지 먼저 확인 (없으면 여기서 404 안내)
  await gh(base);

  const [commits, pulls, issues] = await Promise.all([
    ghList<GhCommit>(`${base}/commits`, maxEach),
    ghList<GhPull>(`${base}/pulls?state=all`, maxEach),
    ghList<GhIssue>(`${base}/issues?state=all`, maxEach),
  ]);

  const docs: HistoryDoc[] = [];

  for (const p of pulls) {
    const status = p.merged_at ? "병합됨" : p.state === "open" ? "열림" : "닫힘";
    docs.push({
      id: `PR-${p.number}`,
      date: shortDate(p.merged_at ?? p.closed_at ?? p.created_at),
      team: full,
      type: "PR",
      title: p.title,
      summary: `#${p.number} · ${status}${p.user?.login ? ` · ${p.user.login}` : ""}`,
      body: clip(p.body) || "(PR 설명 없음)",
      url: p.html_url,
      author: p.user?.login,
      source: "github",
    });
  }

  for (const i of issues) {
    if (i.pull_request) continue; // PR은 위에서 처리
    const labels = (i.labels ?? []).map((l) => l.name).filter(Boolean).join(", ");
    docs.push({
      id: `ISSUE-${i.number}`,
      date: shortDate(i.closed_at ?? i.created_at),
      team: full,
      type: "이슈",
      title: i.title,
      summary: `#${i.number} · ${i.state === "open" ? "열림" : "닫힘"}${labels ? ` · ${labels}` : ""}`,
      body: clip(i.body) || "(이슈 본문 없음)",
      url: i.html_url,
      author: i.user?.login,
      source: "github",
    });
  }

  for (const c of commits) {
    const msg = c.commit.message ?? "";
    const short = c.sha.slice(0, 7);
    docs.push({
      id: `COMMIT-${short}`,
      date: shortDate(c.commit.author?.date),
      team: full,
      type: "커밋",
      title: firstLine(msg) || "(커밋 메시지 없음)",
      summary: `${short}${c.author?.login ? ` · ${c.author.login}` : c.commit.author?.name ? ` · ${c.commit.author.name}` : ""}`,
      body: clip(msg),
      url: c.html_url,
      author: c.author?.login ?? c.commit.author?.name,
      source: "github",
    });
  }

  // 최신순
  docs.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return { repo: full, docs };
}
