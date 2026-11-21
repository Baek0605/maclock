// MacLock에서 쓰는 공통 데이터 모양

// 기록 종류
// GitHub에서 가져온 것: 커밋, PR, 이슈 / 직접 등록한 것: 개발 설정, 변경 이력, CS 사례, 운영 가이드
export type DocType = "커밋" | "PR" | "이슈" | "개발 설정" | "변경 이력" | "CS 사례" | "운영 가이드";

export type HistoryDoc = {
  id: string; // 예: "PR-12", "ISSUE-9", "COMMIT-a1b2c3d", 예시 "DOC-101", 직접 등록 "USER-001"
  date: string;
  team: string; // 직접 등록은 담당 팀, GitHub 기록은 저장소 이름(owner/repo)
  type: DocType;
  title: string;
  summary: string;
  body: string;
  url?: string; // GitHub 원본 링크 (근거로 보여 줌)
  author?: string;
  source?: "github" | "manual" | "sample";
};

// AI 질문 종류: 지식 검색 / 오류 원인 분석
export type AskMode = "ask" | "analyze";

// 원인 후보 하나와 그 근거 기록 번호
export type Cause = {
  text: string;
  evidence: string[];
};

// 서버가 화면에 돌려주는 결과
export type AskResult = {
  // ai: 실제 AI 답변 / nokey: 키가 없어 관련 기록만 / none: 관련 기록 없음
  status: "ai" | "nokey" | "none";
  answerable: boolean; // 근거가 충분해 답할 수 있었는지
  summary: string;
  inquiry: string; // 리포트 1번: 문의 내용 요약 (오류 원인 분석일 때)
  symptom: string; // 리포트 1번: 확인된 오류 현상 (오류 원인 분석일 때)
  causes: Cause[];
  checks: string[];
  teams: string[];
  draft: string; // 오류 원인 분석일 때만 (고객 답변 초안)
  unknowns: string[]; // 기록만으로 알 수 없는 것
  related: string[]; // 검색으로 찾아 AI에게 넘긴 기록 번호
  model?: string;
};
