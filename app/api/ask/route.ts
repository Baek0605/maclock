import { mask } from "@/lib/masking";
import { systemPrompt, userPrompt } from "@/lib/prompt";
import { allow, clientKey } from "@/lib/rateLimit";
import { findRelated } from "@/lib/search";
import type { AskMode, AskResult, Cause, HistoryDoc } from "@/lib/types";

// POST /api/ask  { mode: "ask" | "analyze", question: string, docs: HistoryDoc[] }
// 1) 기록 마스킹 → 2) 관련 기록 찾기(코드) → 3) AI 답변 → 4) 근거 id 검증(코드)

const MAX_DOCS = 600; // 화면에서 보내는 기록 수 상한
const MAX_QUESTION = 2000;

function emptyResult(status: AskResult["status"], related: string[]): AskResult {
  return {
    status,
    answerable: false,
    summary: "",
    inquiry: "",
    symptom: "",
    causes: [],
    checks: [],
    teams: [],
    draft: "",
    unknowns: [],
    related,
  };
}

function strList(v: unknown, max: number): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "").slice(0, max) : [];
}

export async function POST(req: Request) {
  if (!allow(`ask:${clientKey(req)}`, 10)) {
    return Response.json({ error: "질문이 너무 많습니다. 1분 뒤 다시 시도해 주세요." }, { status: 429 });
  }

  let mode: AskMode = "ask";
  let question = "";
  let docs: HistoryDoc[] = [];
  try {
    const body = (await req.json()) as { mode?: unknown; question?: unknown; docs?: unknown };
    mode = body.mode === "analyze" ? "analyze" : "ask";
    question = typeof body.question === "string" ? body.question.slice(0, MAX_QUESTION) : "";
    docs = Array.isArray(body.docs) ? (body.docs as HistoryDoc[]).slice(0, MAX_DOCS) : [];
  } catch {
    return Response.json({ error: "요청 형식이 잘못되었습니다." }, { status: 400 });
  }
  if (!question.trim()) return Response.json({ error: "질문을 입력해 주세요." }, { status: 400 });

  // 1) 마스킹 (화면에서 직접 등록한 기록에도 민감정보가 있을 수 있으므로 다시 한 번)
  const safeDocs = docs
    .filter((d) => d && typeof d.id === "string" && typeof d.body === "string")
    .map((d) => ({ ...d, title: mask(String(d.title ?? "")).text, body: mask(d.body).text.slice(0, 3000) }));
  const safeQuestion = mask(question).text;

  // 2) 관련 기록 찾기 (지금은 키워드 검색, 2주 차에 임베딩으로 교체)
  const related = findRelated(safeQuestion, safeDocs, 8);
  const relatedIds = related.map((d) => d.id);
  if (!related.length) return Response.json(emptyResult("none", []));

  // 가상 AI 모드: OpenAI를 부르지 않고 검색된 기록으로 정해진 형식의 답을 만든다 (크레딧 사용 안 함)
  // 실제 답과 똑같이 아래 4) 검증을 거친다. 일부러 없는 근거 id(FAKE-000)를 섞어 검증이 걸러내는지도 볼 수 있다.
  const mockMode = process.env.MOCK_AI === "1";

  // 키가 없으면 AI 없이 관련 기록만 돌려준다 (가짜 답을 만들지 않는다)
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey && !mockMode) return Response.json(emptyResult("nokey", relatedIds));

  // 3) AI 답변
  let model = process.env.OPENAI_MODEL || "gpt-5.4-mini";
  let raw = "";
  if (mockMode) {
    model = "가상 AI (MOCK_AI=1, 크레딧 사용 안 함)";
    const top = related.slice(0, 2);
    raw = JSON.stringify({
      answerable: true,
      summary: `가상 AI 모드입니다. 실제 AI를 부르지 않고, 검색된 기록 ${related.length}건으로 답의 형식만 보여 줍니다.`,
      inquiry: mode === "analyze" ? `[가상] ${safeQuestion.slice(0, 60)}` : "",
      symptom: mode === "analyze" ? "[가상] 문의에 적힌 증상" : "",
      causes: top.map((d, i) => ({
        text: `[가상] "${d.title}" 기록이 질문과 가장 관련 있어 보입니다.`,
        evidence: i === 0 ? [d.id, "FAKE-000"] : [d.id],
      })),
      checks: top.map((d) => `${d.id} 원문을 열어 질문과 맞는지 확인`),
      teams: [...new Set(top.map((d) => d.team))],
      draft: mode === "analyze" ? "[가상] 문의하신 내용을 확인하고 있습니다. 원인을 확인한 뒤 다시 안내드리겠습니다." : "",
      unknowns: ["가상 모드라 실제 분석 내용은 없습니다."],
    });
  } else {
    const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt(mode) },
            { role: "user", content: userPrompt(mode, safeQuestion, related) },
          ],
          response_format: { type: "json_object" },
          max_completion_tokens: 2500,
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        console.error("[ask] OpenAI", res.status, detail.slice(0, 500));
        const msg =
          res.status === 401
            ? "OpenAI 키가 올바르지 않습니다."
            : res.status === 429
              ? "OpenAI 사용 한도에 걸렸습니다. 잠시 후 다시 시도하거나 크레딧을 확인해 주세요."
              : res.status === 404 || res.status === 400
                ? `OpenAI 요청이 거절되었습니다. 모델 이름(${model})이 맞는지 OPENAI_MODEL을 확인해 주세요.`
                : `OpenAI 요청 실패 (${res.status})`;
        return Response.json({ error: msg }, { status: 502 });
      }
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      raw = data.choices?.[0]?.message?.content ?? "";
    } catch (e) {
      console.error("[ask] fetch", e);
      return Response.json({ error: "AI 서버에 연결하지 못했습니다." }, { status: 502 });
    }
  }

  // 4) 결과 검증: 형식 확인, 근거 id가 실제로 넘긴 기록에 있는지 확인
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    console.error("[ask] JSON 아님", raw.slice(0, 300));
    return Response.json({ error: "AI 답변 형식이 올바르지 않습니다. 다시 시도해 주세요." }, { status: 502 });
  }
  const allowed = new Set(relatedIds);
  const causes: Cause[] = (Array.isArray(parsed.causes) ? parsed.causes : [])
    .map((c) => {
      const item = c as { text?: unknown; evidence?: unknown };
      return {
        text: typeof item.text === "string" ? item.text : "",
        evidence: strList(item.evidence, 6).filter((id) => allowed.has(id)), // 없는 id는 버린다
      };
    })
    .filter((c) => c.text && c.evidence.length > 0) // 근거 없는 원인은 보여 주지 않는다
    .slice(0, 4);

  const result: AskResult = {
    status: "ai",
    answerable: parsed.answerable === true && causes.length > 0,
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    inquiry: mode === "analyze" && typeof parsed.inquiry === "string" ? parsed.inquiry : "",
    symptom: mode === "analyze" && typeof parsed.symptom === "string" ? parsed.symptom : "",
    causes,
    checks: strList(parsed.checks, 4),
    teams: strList(parsed.teams, 5),
    draft: mode === "analyze" && typeof parsed.draft === "string" ? parsed.draft : "",
    unknowns: strList(parsed.unknowns, 4),
    related: relatedIds,
    model,
  };
  return Response.json(result);
}
