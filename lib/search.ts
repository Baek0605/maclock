import type { HistoryDoc } from "./types";

// 키워드 검색 (1단계). 나중에 임베딩 검색으로 바꿀 자리.
// 질문을 단어로 나누고, 제목에 들어 있으면 4점, 나머지에 들어 있으면 1점을 준다.

// 질문에 흔히 붙지만 검색에 도움이 안 되는 말
const STOP_WORDS = new Set(["이", "가", "을", "를", "은", "는", "왜", "뭐", "무엇", "어떻게", "알려줘", "있나요", "인가요", "원인"]);

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[?!.,"'()]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/(은|는|이|가|을|를|의|에|에서|으로|로|와|과|도|만)$/u, ""))
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
}

// 숫자는 쉼표를 빼고 비교한다 (15,000 = 15000)
function normalize(s: string): string {
  return s.toLowerCase().replace(/(\d),(\d)/g, "$1$2");
}

export function scoreDocs(query: string, docs: HistoryDoc[]): { doc: HistoryDoc; score: number }[] {
  const terms = tokenize(normalize(query));
  if (!terms.length) return [];
  return docs
    .map((doc) => {
      const title = normalize(doc.title);
      const hay = normalize(`${doc.title} ${doc.summary} ${doc.body} ${doc.team} ${doc.type}`);
      let score = 0;
      for (const t of terms) {
        // "결제할", "고쳤던"처럼 끝이 붙은 말은 마지막 글자를 뗀 형태로도 찾아본다
        const forms = t.length >= 3 ? [t, t.slice(0, -1)] : [t];
        if (forms.some((f) => title.includes(f))) score += 4;
        else if (forms.some((f) => hay.includes(f))) score += 1;
      }
      return { doc, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
}

// 히스토리 화면용: 검색어가 없으면 전체
export function filterDocs(query: string, docs: HistoryDoc[]): HistoryDoc[] {
  if (!query.trim()) return docs;
  return scoreDocs(query, docs).map((x) => x.doc);
}

// AI에게 넘길 관련 기록 고르기 (최대 limit개)
export function findRelated(query: string, docs: HistoryDoc[], limit = 6): HistoryDoc[] {
  return scoreDocs(query, docs)
    .slice(0, limit)
    .map((x) => x.doc);
}
