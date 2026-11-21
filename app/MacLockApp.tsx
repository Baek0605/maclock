"use client";

// MacLock 메인 화면 (DevTrace 시안을 옮긴 것)
// 메뉴: 대시보드 / 통합 히스토리 / AI 지식 검색 / 오류 원인 분석 / 자료 등록
// AI 답변은 서버(/api/ask)에서만 만든다. 이 파일은 화면만 담당한다.

import { useEffect, useMemo, useState } from "react";
import { DOC_TYPES, TEAMS, sampleDocs } from "@/data/sampleDocs";
import { filterDocs } from "@/lib/search";
import { MOCK_REPO } from "@/lib/mockGithub";
import type { AskMode, AskResult, DocType, HistoryDoc } from "@/lib/types";
import "./maclock.css";

type Page = "home" | "history" | "search" | "issue" | "add";

const LABELS: Record<Page, [string, string, string]> = {
  home: ["개발 히스토리 대시보드", "GitHub 기록과 팀 문서를 한 화면에서 찾아봅니다.", "대시보드"],
  history: ["통합 히스토리", "커밋·PR·이슈와 팀 문서, 과거 CS를 한곳에서 확인합니다.", "통합 히스토리"],
  search: ["AI 지식 검색", "자연어로 질문하면 관련 기록을 찾아 근거와 함께 답합니다.", "AI 지식 검색"],
  issue: ["오류 원인 분석", "문의나 오류 상황을 넣으면 관련 기록에서 원인 후보를 찾습니다.", "오류 원인 분석"],
  add: ["자료 등록", "GitHub 저장소를 연결하거나 문서를 직접 등록합니다.", "자료 등록"],
};

const NAV: { page: Page; icon: string; label: string }[] = [
  { page: "home", icon: "▦", label: "대시보드" },
  { page: "history", icon: "▤", label: "통합 히스토리" },
  { page: "search", icon: "⌕", label: "AI 지식 검색" },
  { page: "issue", icon: "◇", label: "오류 원인 분석" },
  { page: "add", icon: "＋", label: "자료 등록" },
];

const STORAGE_KEY = "maclock-docs-v1"; // GitHub로 가져온 기록 + 직접 등록한 기록 (이 브라우저에만 저장)
const SEED_ISSUE =
  "가족 서비스를 사용하려는데 가족 구성원을 검색해도 나오지 않습니다. 고객의 친구는 16,000명이며 로그인 오류 로그에서는 문제가 발견되지 않았습니다.";
const SEED_QUESTION = "가족 초대 대상이 검색되지 않는 원인이 무엇인가요?";

const ALL_TYPES: DocType[] = ["PR", "이슈", "커밋", ...DOC_TYPES];

function tagClass(type: string): string {
  const m: Record<string, string> = {
    "개발 설정": "settings",
    "변경 이력": "change",
    "CS 사례": "cs",
    "운영 가이드": "guide",
    커밋: "commit",
    PR: "pr",
    이슈: "issue",
  };
  return `tag ${m[type] ?? "user"}`;
}

function Tag({ type }: { type: string }) {
  return <span className={tagClass(type)}>{type}</span>;
}

// 브라우저 저장소 읽기/쓰기 (막혀 있는 환경에서도 화면이 죽지 않게)
function loadSaved(): HistoryDoc[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as HistoryDoc[]) : [];
  } catch {
    return [];
  }
}
function saveDocs(docs: HistoryDoc[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(docs.filter((d) => d.source !== "sample")));
  } catch {
    /* 저장 실패해도 화면은 계속 쓴다 */
  }
}

type AskState = { loading: boolean; error: string; result: AskResult | null };
const IDLE: AskState = { loading: false, error: "", result: null };


// ───────── 화면 조각 (상태를 props로 받는 독립 컴포넌트) ─────────

function DocRow({ d, onOpen }: { d: HistoryDoc; onOpen: (id: string) => void }) {
  return (
    <button className="rowitem" onClick={() => onOpen(d.id)}>
      <div className="itembody">
        <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
          <Tag type={d.type} /> <span className="itemtitle">{d.title}</span>
        </div>
        <div className="itemsub">
          {d.team} · {d.summary}
        </div>
      </div>
      <span className="date">{d.date}</span>
    </button>
  );
}

function Evidence({ ids, byId, onOpen }: { ids: string[]; byId: Map<string, HistoryDoc>; onOpen: (id: string) => void }) {
  return (
    <>
      {ids.map((id) => {
        const d = byId.get(id);
        if (!d) return null;
        return (
          <div className="evidence" key={id}>
            <div>
              <strong>{d.id}</strong> · {d.title}
              <div style={{ color: "#8592a5", marginTop: 3 }}>
                {d.team} / {d.type}
              </div>
            </div>
            <div className="evlinks">
              <button className="link" onClick={() => onOpen(d.id)}>
                기록 보기
              </button>
              {d.url && (
                <a className="link" href={d.url} target="_blank" rel="noopener noreferrer">
                  GitHub ↗
                </a>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}

function SearchBar({ initial, onSearch, heroStyle }: { initial: string; onSearch: (q: string) => void; heroStyle?: boolean }) {
  // 입력 중에는 이 칸만 바뀌고, 검색 버튼/Enter에서 히스토리로 이동
  const [draft, setDraft] = useState(initial);
  return (
    <div className="searchbar">
      <input
        className="input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSearch(draft);
        }}
        placeholder={heroStyle ? "고객 문의나 오류 증상을 입력하세요 (예: 가족 초대 대상이 검색되지 않습니다)" : "전체 히스토리 검색 (예: 결제 오류, 로그인)"}
      />
      <button
        className="primary"
        onClick={() => onSearch(draft)}
        style={heroStyle ? { background: "#fff", color: "#294eab", borderColor: "#fff" } : undefined}
      >
        {heroStyle ? "AI 분석" : "검색"}
      </button>
    </div>
  );
}


// 오류 원인 분석 결과를 팀이 정한 5단 리포트 형식으로 보여 준다
function reportText(r: AskResult, byId: Map<string, HistoryDoc>): string {
  const evid = [...new Set(r.causes.flatMap((c) => c.evidence))]
    .map((id) => byId.get(id))
    .filter((d): d is HistoryDoc => Boolean(d));
  const lines = [
    "[AI 오류 분석 리포트]",
    "1. 고객 문의 혹은 오류 사항 요약",
    `* 문의 내용: ${r.inquiry || "-"}`,
    `* 오류 현상: ${r.symptom || "-"}`,
    "",
    "2. 예상 오류 원인",
    ...(r.causes.length ? r.causes.map((c) => `* ${c.text}`) : ["* 기록만으로 원인을 찾지 못했습니다."]),
    "",
    "3. 관련 개발 히스토리 및 근거",
    ...(evid.length ? evid.map((d) => `* ${d.team}: ${d.title} (${d.id})${d.url ? ` ${d.url}` : ""}`) : ["* 없음"]),
    "",
    "4. 담당 팀 및 권장 해결 방안",
    `* 관련 팀: ${r.teams.join(", ") || "-"}`,
    ...r.checks.map((c) => `* ${c}`),
    "",
    "5. 고객 답변 초안 (CS 해결하는 경우, 검토 필요)",
    `* ${r.draft || "-"}`,
  ];
  if (r.unknowns.length) lines.push("", "※ 기록만으로 알 수 없는 것", ...r.unknowns.map((u) => `* ${u}`));
  return lines.join("\n");
}

function Report({ r, byId, onOpen }: { r: AskResult; byId: Map<string, HistoryDoc>; onOpen: (id: string) => void }) {
  const [copied, setCopied] = useState(false);
  const evidenceIds = [...new Set(r.causes.flatMap((c) => c.evidence))];
  async function copy() {
    try {
      await navigator.clipboard.writeText(reportText(r, byId));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="answer">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h3 style={{ margin: 0 }}>
          AI 오류 분석 리포트 <span className="tag">근거 확인 필요</span>
        </h3>
        <button className="secondary" onClick={copy} style={{ padding: "6px 10px", fontSize: 11 }}>
          {copied ? "복사됨 ✓" : "리포트 복사"}
        </button>
      </div>

      <div className="answerlabel">1. 고객 문의 혹은 오류 사항 요약</div>
      <ul className="plain">
        <li>
          <strong>문의 내용:</strong> {r.inquiry || "-"}
        </li>
        <li>
          <strong>오류 현상:</strong> {r.symptom || "-"}
        </li>
      </ul>

      <div className="answerlabel">2. 예상 오류 원인</div>
      {r.causes.length ? (
        <ul className="plain">
          {r.causes.map((c, i) => (
            <li key={i}>{c.text}</li>
          ))}
        </ul>
      ) : (
        <p>기록만으로 원인을 찾지 못했습니다.</p>
      )}

      <div className="answerlabel">3. 관련 개발 히스토리 및 근거</div>
      {evidenceIds.length ? <Evidence ids={evidenceIds} byId={byId} onOpen={onOpen} /> : <p>근거로 쓸 기록이 없습니다.</p>}

      <div className="answerlabel">4. 담당 팀 및 권장 해결 방안</div>
      <ul className="plain">
        <li>
          <strong>관련 팀:</strong> {r.teams.join(", ") || "-"}
        </li>
        {r.checks.map((c, i) => (
          <li key={i}>{c}</li>
        ))}
      </ul>

      <div className="answerlabel">5. 고객 답변 초안 (CS 해결하는 경우 · 검토 필요)</div>
      <div className="draft">{r.draft || "-"}</div>

      {r.unknowns.length > 0 && (
        <>
          <div className="answerlabel">기록만으로 알 수 없는 것</div>
          <ul className="plain">
            {r.unknowns.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </>
      )}

      <p style={{ fontSize: 10, color: "#8592a5", marginTop: 13 }}>
        ※ AI가 등록된 기록만 근거로 만든 리포트입니다{r.model ? ` (${r.model})` : ""}. 근거 원문을 열어 직접 확인한 뒤
        판단하세요. 고객 답변은 담당자가 검토한 뒤 보내세요.
      </p>
    </div>
  );
}

function Result({
state,
mode,
byId,
onOpen,
}: {
state: AskState;
mode: AskMode;
byId: Map<string, HistoryDoc>;
onOpen: (id: string) => void;
}) {
  if (state.loading) return <div className="loading">관련 기록을 찾고 AI가 답을 정리하는 중입니다…</div>;
  if (state.error) return <div className="errorbox">{state.error}</div>;
  const r = state.result;
  if (!r) return null;

  if (r.status === "none") {
    return (
      <div className="answer">
        <h3>관련 기록을 찾지 못했습니다</h3>
        <p>
          입력한 내용과 연결되는 기록이 없습니다. 다른 표현으로 질문하거나, 자료 등록에서 관련 저장소나 문서를 추가한 뒤
          다시 시도해 주세요. 근거 없이 원인을 단정하지 않습니다.
        </p>
      </div>
    );
  }

  if (r.status === "nokey") {
    return (
      <div className="answer">
        <h3>
          관련 기록 <span className="tag">AI 키 없음</span>
        </h3>
        <p>
          OpenAI 키가 설정되지 않아 AI 답변 없이, 질문과 관련 있어 보이는 기록 {r.related.length}건만 보여 드립니다.
          원문을 직접 확인해 주세요.
        </p>
        <div className="answerlabel">관련 기록</div>
        <Evidence ids={r.related} byId={byId} onOpen={onOpen} />
      </div>
    );
  }

  // 오류 원인 분석이고 근거가 있으면 팀이 정한 5단 리포트 형식으로
  if (mode === "analyze" && r.answerable) return <Report r={r} byId={byId} onOpen={onOpen} />;

  return (
    <div className="answer">
      <h3>
        {r.answerable ? (mode === "analyze" ? "AI 분석 결과" : "AI 답변") : "기록만으로는 답하기 어렵습니다"}{" "}
        <span className="tag">근거 확인 필요</span>
      </h3>
      {r.summary && <p>{r.summary}</p>}

      {r.causes.length > 0 && (
        <>
          <div className="answerlabel">{mode === "analyze" ? "가능성 있는 원인" : "이유 · 해결 과정"}</div>
          {r.causes.map((c, i) => (
            <div className="cause" key={i}>
              <p>
                <strong>{i + 1}.</strong> {c.text}
              </p>
              <div className="evlist">
                <Evidence ids={c.evidence} byId={byId} onOpen={onOpen} />
              </div>
            </div>
          ))}
        </>
      )}

      {r.checks.length > 0 && (
        <>
          <div className="answerlabel">직접 확인할 것</div>
          <ul className="plain">
            {r.checks.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </>
      )}

      {r.teams.length > 0 && (
        <>
          <div className="answerlabel">관련 팀 · 저장소</div>
          {r.teams.map((t) => (
            <span className="tag" key={t} style={{ marginRight: 5 }}>
              {t}
            </span>
          ))}
        </>
      )}

      {r.draft && (
        <>
          <div className="answerlabel">고객 답변 초안 · 검토 필요</div>
          <div className="draft">{r.draft}</div>
        </>
      )}

      {r.unknowns.length > 0 && (
        <>
          <div className="answerlabel">기록만으로 알 수 없는 것</div>
          <ul className="plain">
            {r.unknowns.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </>
      )}

      {!r.answerable && r.related.length > 0 && (
        <>
          <div className="answerlabel">검색된 기록</div>
          <Evidence ids={r.related} byId={byId} onOpen={onOpen} />
        </>
      )}

      <p style={{ fontSize: 10, color: "#8592a5", marginTop: 13 }}>
        ※ AI가 등록된 기록만 근거로 만든 답변입니다{r.model ? ` (${r.model})` : ""}. 근거 원문을 열어 직접 확인한 뒤
        판단하세요.
      </p>
    </div>
  );
}


export default function MacLockApp() {
  const [page, setPage] = useState<Page>("home");
  const [docs, setDocs] = useState<HistoryDoc[]>(sampleDocs);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<{ ai: boolean; github: boolean; mock?: boolean } | null>(null);

  // 통합 히스토리
  const [term, setTerm] = useState("");
  const [team, setTeam] = useState("전체");
  const [type, setType] = useState("전체");
  const [selected, setSelected] = useState("DOC-101");

  // AI 검색 / 원인 분석
  const [question, setQuestion] = useState(SEED_QUESTION);
  const [issue, setIssue] = useState(SEED_ISSUE);
  const [askState, setAskState] = useState<AskState>(IDLE);
  const [analyzeState, setAnalyzeState] = useState<AskState>(IDLE);

  // 자료 등록
  const [repoInput, setRepoInput] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newTeam, setNewTeam] = useState(TEAMS[0]);
  const [newType, setNewType] = useState<DocType>("개발 설정");
  const [newBody, setNewBody] = useState("");
  const [addMsg, setAddMsg] = useState("");
  const [uploadMsg, setUploadMsg] = useState("파일을 읽어 위 내용 칸에 채웁니다.");

  // 처음 열 때: 저장해 둔 기록 불러오기 + 서버 설정 상태 확인
  useEffect(() => {
    const saved = loadSaved();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 브라우저 저장소는 화면이 뜬 뒤에만 읽을 수 있다
    if (saved.length) setDocs([...saved, ...sampleDocs]);
    setLoaded(true);
    fetch("/api/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ ai: false, github: false, mock: false }));
  }, []);

  // 기록이 바뀌면 저장 (처음 불러오기 전에는 저장하지 않음)
  useEffect(() => {
    if (loaded) saveDocs(docs);
  }, [docs, loaded]);

  const byId = useMemo(() => new Map(docs.map((d) => [d.id, d])), [docs]);
  const repos = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of docs) if (d.source === "github") m.set(d.team, (m.get(d.team) ?? 0) + 1);
    return [...m.entries()];
  }, [docs]);

  function go(p: Page) {
    setPage(p);
    if (p === "history") {
      setTeam("전체");
      setType("전체");
    }
  }

  function openDoc(id: string) {
    setSelected(id);
    setTeam("전체");
    setType("전체");
    setPage("history");
  }

  function searchHistory(q: string) {
    setTerm(q);
    setTeam("전체");
    setType("전체");
    setPage("history");
  }

  // 대시보드 검색창: 문의·오류를 넣으면 오류 원인 분석 리포트로 바로 이동
  function analyzeFromHero(text: string) {
    if (!text.trim()) return;
    setIssue(text);
    setPage("issue");
    runAsk("analyze", text);
  }

  async function runAsk(mode: AskMode, text: string) {
    const set = mode === "analyze" ? setAnalyzeState : setAskState;
    if (!text.trim()) {
      set({ loading: false, error: "내용을 입력해 주세요.", result: null });
      return;
    }
    set({ loading: true, error: "", result: null });
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, question: text, docs }),
      });
      const data = await res.json();
      if (!res.ok) set({ loading: false, error: data.error ?? "요청에 실패했습니다.", result: null });
      else set({ loading: false, error: "", result: data as AskResult });
    } catch {
      set({ loading: false, error: "서버에 연결하지 못했습니다.", result: null });
    }
  }

  async function importGithub(override?: string) {
    const target = override ?? repoInput;
    if (!target.trim()) {
      setImportMsg({ ok: false, text: "저장소 주소를 입력해 주세요. 예: https://github.com/owner/repo" });
      return;
    }
    setImporting(true);
    setImportMsg(null);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo: target }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImportMsg({ ok: false, text: data.error ?? "가져오기에 실패했습니다." });
      } else {
        const incoming = data.docs as HistoryDoc[];
        // 같은 저장소를 다시 가져오면 이전 기록을 바꿔 넣는다
        setDocs((prev) => [...incoming, ...prev.filter((d) => !(d.source === "github" && d.team === data.repo))]);
        const counts = { PR: 0, 이슈: 0, 커밋: 0 } as Record<string, number>;
        for (const d of incoming) counts[d.type] = (counts[d.type] ?? 0) + 1;
        setImportMsg({
          ok: true,
          text: `✓ ${data.mock ? "[가상 저장소] " : ""}${data.repo}에서 PR ${counts.PR}개, 이슈 ${counts["이슈"]}개, 커밋 ${counts["커밋"]}개를 가져왔습니다.${
            data.masked ? ` 민감정보 ${data.masked}곳을 가렸습니다.` : ""
          }`,
        });
        setRepoInput("");
      }
    } catch {
      setImportMsg({ ok: false, text: "서버에 연결하지 못했습니다." });
    } finally {
      setImporting(false);
    }
  }

  function removeRepo(repo: string) {
    setDocs((prev) => prev.filter((d) => !(d.source === "github" && d.team === repo)));
  }

  function saveManual() {
    if (!newTitle.trim() || !newBody.trim()) {
      setAddMsg("문서 제목과 내용을 모두 입력해 주세요.");
      return;
    }
    const n = docs.filter((d) => d.source === "manual").length + 1;
    const id = `USER-${String(n).padStart(3, "0")}`;
    const doc: HistoryDoc = {
      id,
      date: "신규",
      team: newTeam,
      type: newType,
      title: newTitle.trim(),
      summary: newBody.trim().slice(0, 75),
      body: newBody.trim(),
      source: "manual",
    };
    setDocs((prev) => [doc, ...prev]);
    setNewTitle("");
    setNewBody("");
    setAddMsg("");
    openDoc(id);
  }

  async function onUpload(file: File | undefined) {
    if (!file) return;
    if (file.size > 307200) {
      setUploadMsg("파일이 너무 큽니다. 300KB 이하만 지원합니다.");
      return;
    }
    try {
      const content = await file.text();
      setNewBody(content.slice(0, 60000));
      if (!newTitle) setNewTitle(file.name.replace(/\.[^.]+$/, ""));
      setUploadMsg(`✓ ${file.name} 내용 불러오기 완료. 저장 버튼을 눌러 등록하세요.`);
    } catch {
      setUploadMsg("파일을 읽지 못했습니다. 텍스트 파일인지 확인해 주세요.");
    }
  }

  function resetAll() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* 무시 */
    }
    setDocs(sampleDocs);
    setPage("home");
    setTerm("");
    setTeam("전체");
    setType("전체");
    setSelected("DOC-101");
    setQuestion(SEED_QUESTION);
    setIssue(SEED_ISSUE);
    setAskState(IDLE);
    setAnalyzeState(IDLE);
    setImportMsg(null);
    setAddMsg("");
  }

  // ───────── 화면별 ─────────

  function Home() {
    const teamCount = new Set(docs.map((d) => d.team)).size;
    const ghCount = docs.filter((d) => d.source === "github").length;
    return (
      <>
        <div className="hero">
          <div style={{ fontSize: 10, color: "#bfd0ff", fontWeight: 750, marginBottom: 9, letterSpacing: 1 }}>
            DEVELOPMENT KNOWLEDGE HUB
          </div>
          <h3>코드는 남지만, 맥락은 남지 않는다. 흩어진 개발 이력을 AI로 한 번에 찾아보세요.</h3>
          <p>
            고객 문의나 오류 증상을 입력하면, GitHub의 커밋·PR·이슈와 팀 문서, 과거 고객 문의를 엮어 AI 오류 분석 리포트를
            만들어 드립니다.
          </p>
          <SearchBar initial="" onSearch={analyzeFromHero} heroStyle />
          <div className="quick">
            {[
              ["가족 초대 검색 실패", SEED_ISSUE],
              ["결제 중 KeyError", "결제할 때 500 에러가 납니다. 로그에 KeyError: 'data'가 찍힙니다."],
              ["로그인 후 페이지 접근 실패", "로그인한 뒤 특정 페이지에 들어가면 계속 오류가 납니다. 다시 로그인해도 같습니다."],
            ].map(([label, text]) => (
              <button className="chip" key={label} onClick={() => analyzeFromHero(text)}>
                {label}
              </button>
            ))}
            <button className="chip" onClick={() => go("history")}>
              기록 목록으로 찾기 →
            </button>
          </div>
        </div>

        <div className="stats">
          <div className="stat">
            <small>전체 개발 히스토리</small>
            <strong>{docs.length}</strong>
            <span>등록된 기록</span>
          </div>
          <div className="stat">
            <small>GitHub 기록</small>
            <strong>{ghCount}</strong>
            <span>연결된 저장소 {repos.length}개</span>
          </div>
          <div className="stat">
            <small>관련 팀 · 저장소</small>
            <strong>{teamCount}</strong>
            <span>팀별 이력 통합</span>
          </div>
          <div className="stat">
            <small>AI 분석</small>
            <strong style={{ fontSize: 18, marginTop: 4, color: status?.ai ? "#20704d" : "#94601c" }}>
              {status === null ? "확인 중" : status.mock ? "가상 모드" : status.ai ? "연결됨" : "키 없음"}
            </strong>
            <span>{status?.mock ? "크레딧 사용 안 함" : status?.ai ? "질문할 때마다 AI가 답변" : "관련 기록만 보여 줌"}</span>
          </div>
        </div>

        <div className="cols">
          <section className="card">
            <div className="sectionhead">
              <h3>최근 등록된 히스토리</h3>
              <button className="link" onClick={() => go("history")}>
                전체 보기 →
              </button>
            </div>
            {docs.slice(0, 5).map((d) => (
              <DocRow key={d.id} d={d} onOpen={openDoc} />
            ))}
          </section>
          <section className="card">
            <div className="sectionhead">
              <h3>추천 AI 분석 사례</h3>
              <span className="tag">가상 예시</span>
            </div>
            <div className="cardpad">
              <div style={{ fontSize: 11, fontWeight: 750, color: "#385a9e", marginBottom: 9 }}>
                CASE 01 · 가족 초대 검색 실패
              </div>
              <p style={{ fontSize: 12, lineHeight: 1.75, color: "#4a5f7d" }}>
                고객의 친구 수는 16,000명. 로그인 로그에는 오류가 없는데 가족을 초대할 수 없다면?
              </p>
              <div className="insight">
                <strong>AI가 확인해야 할 내용</strong>
                <p>로그 외에도 다른 팀의 개발 설정, API 조회 제한, 과거 유사 CS 기록을 함께 탐색</p>
              </div>
              <button
                className="primary"
                style={{ marginTop: 16, width: "100%" }}
                onClick={() => {
                  setIssue(SEED_ISSUE);
                  setPage("issue");
                  runAsk("analyze", SEED_ISSUE);
                }}
              >
                이 사례 AI로 분석하기
              </button>
            </div>
          </section>
        </div>
        <div className="flowline">
          <span>① GitHub 연결 · 자료 등록</span>→<span>② 문의 · 오류 입력</span>→<span>③ AI 근거 조회</span>→
          <span>④ 오류 분석 리포트 · 답변 초안</span>
        </div>
      </>
    );
  }

  function History() {
    const filtered = filterDocs(term, docs).filter(
      (d) => (team === "전체" || d.team === team) && (type === "전체" || d.type === type),
    );
    const teams = [...new Set(docs.map((d) => d.team))];
    const sel = filtered.find((d) => d.id === selected) ?? filtered[0];
    return (
      <>
        <div className="card cardpad" style={{ marginBottom: 16 }}>
          <SearchBar key={term} initial={term} onSearch={searchHistory} />
          <div className="quick">
            <span className="muted" style={{ padding: "7px 0" }}>
              빠른 검색
            </span>
            {["친구", "가족", "로그인", "fix"].map((q) => (
              <button className="chip" key={q} onClick={() => setTerm(q)}>
                {q}
              </button>
            ))}
            {term && (
              <button className="chip" onClick={() => setTerm("")}>
                검색어 지우기 ✕
              </button>
            )}
          </div>
        </div>
        <div className="filterbar">
          <select className="input" value={team} onChange={(e) => setTeam(e.target.value)}>
            <option>전체</option>
            {teams.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option>전체</option>
            {ALL_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <button className="secondary" onClick={() => go("add")}>
            + 자료 추가
          </button>
        </div>
        <div className="historygrid">
          <section className="card">
            <div className="sectionhead">
              <h3>검색 결과</h3>
              <span className="muted">{filtered.length}개 기록</span>
            </div>
            {filtered.length ? (
              filtered.slice(0, 200).map((d) => (
                <button
                  key={d.id}
                  className={`docrow ${sel?.id === d.id ? "active" : ""}`}
                  onClick={() => setSelected(d.id)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 9, marginBottom: 8 }}>
                    <Tag type={d.type} />
                    <span className="muted">{d.date}</span>
                  </div>
                  <div className="itemtitle" style={{ fontSize: 12 }}>
                    {d.title}
                  </div>
                  <div className="itemsub">
                    {d.team} · {d.summary}
                  </div>
                </button>
              ))
            ) : (
              <div className="empty">
                일치하는 기록이 없습니다.
                <br />
                다른 검색어를 입력해 주세요.
              </div>
            )}
          </section>
          <section className="card">
            <div className="sectionhead">
              <h3>기록 상세 보기</h3>
              <span className="muted">{sel?.source === "github" ? "GitHub" : sel?.source === "sample" ? "가상 예시" : "직접 등록"}</span>
            </div>
            {sel ? (
              <div className="details">
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 13 }}>
                  <Tag type={sel.type} />
                  <span className="muted">{sel.id}</span>
                </div>
                <h3 style={{ fontSize: 16, lineHeight: 1.5 }}>{sel.title}</h3>
                <div className="metarow">
                  {sel.source === "github" ? "저장소" : "담당 팀"}: <strong>{sel.team}</strong> · 기록일: {sel.date}
                  {sel.author ? ` · 작성자: ${sel.author}` : ""}
                </div>
                <div className="answerlabel">저장된 기록 내용</div>
                <div className="docBody">{sel.body}</div>
                <div style={{ marginTop: 17, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    className="primary"
                    onClick={() => {
                      const q = `${sel.title} — 이 변경은 왜 했고 어떤 문제와 관련 있나요?`;
                      setQuestion(q);
                      setPage("search");
                      runAsk("ask", q);
                    }}
                  >
                    이 기록 관련 AI 질문
                  </button>
                  {sel.url && (
                    <a className="secondary" href={sel.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                      GitHub에서 보기 ↗
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="empty">좌측 기록을 선택해 주세요.</div>
            )}
          </section>
        </div>
      </>
    );
  }

  function Search() {
    const samples = [
      "친구 검색이 15000건으로 제한된 이유는?",
      "로그인 세션 관련 변경 이력 찾아줘",
      "이 버그 예전에 어떻게 고쳤어?",
    ];
    return (
      <div className="cols">
        <section className="card cardpad">
          <h3 style={{ marginBottom: 7 }}>무엇을 찾고 싶으신가요?</h3>
          <p className="subtitle" style={{ marginBottom: 15 }}>
            자연어로 질문하면 등록된 기록에서 관련 근거를 찾아 답합니다. 에러 메시지를 붙여넣어도 됩니다.
          </p>
          <div className="field">
            <label className="lab">질문 입력</label>
            <textarea
              className="input"
              style={{ minHeight: 130 }}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="예: 결제 응답 검사 코드는 왜 추가했어?"
            />
          </div>
          <button className="primary" style={{ width: "100%" }} disabled={askState.loading} onClick={() => runAsk("ask", question)}>
            {askState.loading ? "찾는 중…" : "AI 검색 실행 ↗"}
          </button>
          <div className="quick">
            {samples.map((q) => (
              <button className="chip" key={q} onClick={() => setQuestion(q)}>
                {q}
              </button>
            ))}
          </div>
          <div className="insight">
            <strong>일반 검색과 다른 점</strong>
            <p>
              문서 제목을 찾는 데 그치지 않고 여러 기록을 연결해 이유와 원인 후보를 정리하고, 모든 내용에 근거 기록을 붙입니다.
              근거가 없으면 답을 지어내지 않습니다.
            </p>
          </div>
        </section>
        <section className="card cardpad">
          <h3>AI 답변 및 출처</h3>
          {askState.loading || askState.error || askState.result ? (
            <Result state={askState} mode="ask" byId={byId} onOpen={openDoc} />
          ) : (
            <div className="empty">
              <div style={{ fontSize: 25, marginBottom: 13 }}>✦</div>
              좌측에 질문을 입력하고
              <br />
              <strong>AI 검색 실행</strong>을 눌러 보세요.
            </div>
          )}
        </section>
      </div>
    );
  }

  function Issue() {
    return (
      <div className="cols">
        <section className="card cardpad">
          <h3 style={{ marginBottom: 7 }}>새로운 문의 · 오류 분석</h3>
          <p className="subtitle" style={{ marginBottom: 16 }}>
            오류 증상을 입력하면 과거 이슈·PR·CS 기록과 팀 문서를 함께 검색해 원인 후보를 찾습니다.
          </p>
          <div className="field">
            <label className="lab">고객 문의 / 오류 상황</label>
            <textarea className="input" style={{ minHeight: 155 }} value={issue} onChange={(e) => setIssue(e.target.value)} />
          </div>
          <button className="primary" style={{ width: "100%" }} disabled={analyzeState.loading} onClick={() => runAsk("analyze", issue)}>
            {analyzeState.loading ? "분석 중…" : "✦ AI 원인 분석 시작"}
          </button>
          <div className="insight">
            <strong>분석에 활용하는 자료</strong>
            <p>GitHub에서 가져온 커밋·PR·이슈, 직접 등록한 개발 설정·변경 이력·운영 문서·과거 CS 사례</p>
          </div>
        </section>
        <section className="card cardpad">
          <h3>AI 오류 분석 리포트</h3>
          {analyzeState.loading || analyzeState.error || analyzeState.result ? (
            <Result state={analyzeState} mode="analyze" byId={byId} onOpen={openDoc} />
          ) : (
            <div className="empty">
              <div style={{ fontSize: 24, marginBottom: 12 }}>◇</div>
              문의를 입력하고 분석을 시작하세요.
            </div>
          )}
        </section>
      </div>
    );
  }

  function Add() {
    return (
      <div className="cols">
        <div style={{ display: "flex", flexDirection: "column", gap: 15, minWidth: 0 }}>
          <section className="card cardpad">
            <h3 style={{ marginBottom: 8 }}>GitHub 저장소 연결</h3>
            <p className="subtitle" style={{ marginBottom: 14 }}>
              공개 저장소 주소를 넣으면 최근 PR·이슈·커밋을 가져와 히스토리에 추가합니다.
            </p>
            <div className="searchbar">
              <input
                className="input"
                value={repoInput}
                onChange={(e) => setRepoInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") importGithub();
                }}
                placeholder="https://github.com/owner/repo"
              />
              <button className="primary" onClick={() => importGithub()} disabled={importing}>
                {importing ? "가져오는 중…" : "가져오기"}
              </button>
            </div>
            <div className="quick">
              <button className="chip" onClick={() => importGithub(MOCK_REPO)} disabled={importing}>
                가상 저장소 불러오기 (테스트용)
              </button>
              <span className="muted" style={{ padding: "7px 0" }}>
                error-lab 버그 5개의 이슈·PR·커밋 예시. 토큰 없이 동작
              </span>
            </div>
            {importMsg && <div className={importMsg.ok ? "okbox" : "errorbox"}>{importMsg.text}</div>}
            {status && !status.github && (
              <p className="muted" style={{ marginTop: 10 }}>
                GitHub 토큰이 설정되지 않아 요청 한도가 작습니다(시간당 약 60번). .env.local에 GITHUB_TOKEN을 넣으면 넉넉해집니다.
              </p>
            )}
            {repos.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div className="answerlabel" style={{ marginTop: 4 }}>
                  연결된 저장소
                </div>
                {repos.map(([repo, count]) => (
                  <div className="repoRow" key={repo}>
                    <span>
                      <strong>{repo}</strong> <span className="muted">· 기록 {count}개</span>
                    </span>
                    <button className="link" onClick={() => removeRepo(repo)}>
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card cardpad">
            <h3 style={{ marginBottom: 8 }}>문서 직접 등록</h3>
            <p className="subtitle" style={{ marginBottom: 18 }}>
              GitHub에 없는 팀 문서나 CS 기록을 추가합니다.
            </p>
            <div className="field">
              <label className="lab">문서 제목</label>
              <input className="input" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="예: 로그인 API 반환 조건 변경 이력" />
            </div>
            <div className="fieldgrid">
              <div className="field">
                <label className="lab">담당 팀</label>
                <select className="input" value={newTeam} onChange={(e) => setNewTeam(e.target.value)}>
                  {TEAMS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="lab">문서 유형</label>
                <select className="input" value={newType} onChange={(e) => setNewType(e.target.value as DocType)}>
                  {DOC_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label className="lab">기록 내용</label>
              <textarea
                className="input"
                style={{ minHeight: 140 }}
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                placeholder="설정 내용, 변경 사유, 문의 증상, 담당 팀의 확인 사항 등을 입력하세요."
              />
            </div>
            <div className="file">
              <strong style={{ fontSize: 12 }}>또는 텍스트 파일 불러오기</strong>
              <p>.txt · .md · .csv · .json (300KB 이하)</p>
              <input type="file" accept=".txt,.md,.csv,.json,text/plain,text/csv,application/json" onChange={(e) => onUpload(e.target.files?.[0])} />
              <p>{uploadMsg}</p>
            </div>
            <button className="primary" style={{ width: "100%" }} onClick={saveManual}>
              + 히스토리에 저장
            </button>
            {addMsg && <div className="errorbox">{addMsg}</div>}
          </section>
        </div>

        <section className="card cardpad">
          <h3>어떻게 활용되나요?</h3>
          {[
            ["GitHub 연결 · 문서 등록", "PR·이슈·커밋을 가져오고, 팀 문서와 과거 CS를 추가"],
            ["민감정보 가리기", "토큰·API 키·비밀번호·이메일을 코드로 자동으로 가림"],
            ["관련 기록 찾기", "질문과 관련된 기록을 검색 (키워드 → 임베딩 예정)"],
            ["AI 답변과 근거", "찾은 기록만 AI에게 넘겨 답을 만들고, 모든 내용에 근거 기록을 붙임"],
            ["사람이 확인", "근거 원문(GitHub 링크)을 열어 직접 확인한 뒤 판단"],
          ].map(([t, d], i) => (
            <div className="step" key={t}>
              <span className="stepnumber">{i + 1}</span>
              <div>
                <strong>{t}</strong>
                <p>{d}</p>
              </div>
            </div>
          ))}
          <div className="callout" style={{ marginTop: 17 }}>
            <strong>저장 안내</strong>
            <br />
            가져온 기록과 직접 등록한 문서는 지금 쓰는 브라우저에만 저장됩니다. 실제 고객정보나 사내 기밀은 등록하지 마세요.
            &lsquo;초기화&rsquo;를 누르면 예시 데이터만 남습니다.
          </div>
        </section>
      </div>
    );
  }

  const [title, desc, crumb] = LABELS[page];
  const views: Record<Page, () => React.ReactElement> = { home: Home, history: History, search: Search, issue: Issue, add: Add };

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <div className="logo">M</div>
          <div>
            <strong>MacLock</strong>
            <small>개발 히스토리 검색</small>
          </div>
        </div>
        <nav className="nav" aria-label="메뉴">
          {NAV.map((n) => (
            <button key={n.page} className={page === n.page ? "active" : ""} onClick={() => go(n.page)}>
              <span className="navicon">{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>
        <div className="sidebarfoot">
          <div>
            <span className="dot" />
            <strong>MacLock</strong>
          </div>
          예시 기록(DOC·CS·CHG)은 인터뷰 사례를 재구성한 가상 데이터입니다. GitHub에서 가져온 기록은 원본 링크로 확인할 수
          있습니다.
        </div>
      </aside>
      <div className="work">
        <div className="topbar">
          <div className="crumb">
            개발 운영 / <span>{crumb}</span>
          </div>
          <div className="topright">
            <span className={`demo ${status?.ai && !status?.mock ? "ok" : ""}`}>
              {status === null
                ? "● 확인 중"
                : status.mock
                  ? "● 가상 AI 모드 · 크레딧 사용 안 함"
                  : status.ai
                    ? "● AI 연결됨"
                    : "● AI 키 없음 · 관련 기록만 표시"}
            </span>
            <div className="avatar">DEV</div>
          </div>
        </div>
        <main className="content">
          <div className="head">
            <div>
              <h2>{title}</h2>
              <p className="subtitle">{desc}</p>
            </div>
            <button className="secondary" onClick={resetAll}>
              초기화
            </button>
          </div>
          {views[page]()}
        </main>
      </div>
    </div>
  );
}
