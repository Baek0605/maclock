import type { HistoryDoc } from "./types";

// 가상 GitHub 저장소 (테스트용, 네트워크·토큰 없이 동작)
// 개인 프로젝트 error-lab의 버그 5개를 이슈 → PR → 커밋 흐름으로 만든 예시 기록.
// 정답을 알고 있으므로 AI가 맞는 근거를 찾는지 채점할 수 있다.

export const MOCK_REPO = "maclock-demo/error-lab";

const R = MOCK_REPO;
const d = (x: Omit<HistoryDoc, "team" | "source">): HistoryDoc => ({ ...x, team: R, source: "github" });

export const mockRepoDocs: HistoryDoc[] = [
  // 버그 1: 회원 프로필 (plan이 None)
  d({ id: "ISSUE-1", date: "2026-11-02", type: "이슈", title: "프로필 조회 시 TypeError: 'NoneType' object is not subscriptable", summary: "#1 · 닫힘 · bug", author: "kim",
    body: "GET /users/3/profile 에서 500 에러.\n로그: TypeError: 'NoneType' object is not subscriptable (services/users.py 21번째 줄)\n3번 회원만 발생. 다른 회원은 정상." }),
  d({ id: "PR-2", date: "2026-11-03", type: "PR", title: "요금제가 없는 회원의 프로필 조회 오류 수정", summary: "#2 · 병합됨 · baek", author: "baek",
    body: "원인: 3번 회원은 존재하지만 plan 값이 None이라 user[\"plan\"][\"type\"]에서 에러가 났습니다. 로그의 ~^ 표시가 user[\"plan\"] 아래에 있어 user가 아니라 plan이 None임을 확인했습니다.\n수정: plan이 없으면 \"free\"로 표시하도록 변경.\nCloses #1" }),
  d({ id: "COMMIT-1a2b3c4", date: "2026-11-03", type: "커밋", title: "fix: plan이 없는 회원은 free로 표시", summary: "1a2b3c4 · baek", author: "baek",
    body: "fix: plan이 없는 회원은 free로 표시\n\nuser[\"plan\"]이 None일 때 TypeError 발생하던 문제" }),

  // 버그 2: 주문 (quantity 누락)
  d({ id: "ISSUE-3", date: "2026-11-04", type: "이슈", title: "주문 생성 시 KeyError: 'quantity'", summary: "#3 · 닫힘 · bug", author: "lee",
    body: "POST /orders 가 가끔 500.\n앱 일부 화면에서 수량 없이 주문 요청을 보내는 것으로 보임." }),
  d({ id: "PR-4", date: "2026-11-05", type: "PR", title: "주문 요청 필수 값 검사 추가", summary: "#4 · 병합됨 · lee", author: "lee",
    body: "원인: 요청 본문에 quantity가 없으면 calc_total에서 KeyError가 났습니다. 서버가 필수 값을 검사하지 않았습니다.\n수정: item_id, quantity가 없으면 400과 안내 메시지를 돌려주도록 변경.\nCloses #3" }),

  // 버그 3: 통계 (대소문자)
  d({ id: "ISSUE-5", date: "2026-11-06", type: "이슈", title: "카테고리 평균 가격 조회 시 ZeroDivisionError", summary: "#5 · 닫힘 · bug", author: "kim",
    body: "GET /stats/average?category=Books 에서 500.\nZeroDivisionError: division by zero (compute_avg)\ncategory=books 로 보내면 정상." }),
  d({ id: "PR-6", date: "2026-11-07", type: "PR", title: "카테고리 비교를 대소문자 구분 없이 변경", summary: "#6 · 병합됨 · baek", author: "baek",
    body: "원인: 에러는 나눗셈 줄에서 났지만, 진짜 원인은 filter_by_category가 대소문자를 구분해서 Books로 요청하면 상품이 0개가 된 것입니다.\n수정: 카테고리를 소문자로 맞춰 비교하고, 상품이 없으면 404를 돌려주도록 변경. 0으로 나누지 않게만 막는 방식은 증상만 가리는 것이라 쓰지 않았습니다.\nCloses #5" }),

  // 버그 4: 리포트 (DB 연결)
  d({ id: "ISSUE-7", date: "2026-11-08", type: "이슈", title: "일일 리포트 RuntimeError: 매출 데이터 조회 실패", summary: "#7 · 닫힘 · bug, infra", author: "park",
    body: "GET /reports/daily 500.\n마지막 줄은 RuntimeError지만 위쪽에 ConnectionRefusedError: db.internal:5432 가 있음." }),
  d({ id: "PR-8", date: "2026-11-09", type: "PR", title: "리포트 DB 접속 주소 설정 수정", summary: "#8 · 병합됨 · park", author: "park",
    body: "원인: 배포 환경의 DB 주소 설정이 잘못되어 연결이 거부되었습니다. 리포트 코드 문제가 아니었습니다.\n수정: DB 주소를 환경 변수로 분리하고, 연결 실패 시 원래 에러가 로그에 남도록 변경.\nCloses #7" }),

  // 버그 5: 결제 (외부 API 503)
  d({ id: "ISSUE-9", date: "2026-11-10", type: "이슈", title: "결제 시 KeyError: 'data'", summary: "#9 · 닫힘 · bug", author: "lee",
    body: "POST /payments 500.\n직전 로그에 WARNING 결제 API 응답 status=503 이 있음." }),
  d({ id: "PR-10", date: "2026-11-11", type: "PR", title: "결제 API 503 응답 처리", summary: "#10 · 병합됨 · baek", author: "baek",
    body: "원인: 결제사가 점검 중일 때 503 에러 응답을 줬는데, 코드가 응답 상태를 확인하지 않고 response[\"data\"]를 읽어 KeyError가 났습니다.\n수정: status가 ok가 아니면 \"결제사 점검 중\" 안내와 함께 재시도하도록 변경.\nCloses #9" }),
  d({ id: "COMMIT-9f8e7d6", date: "2026-11-11", type: "커밋", title: "fix: 결제 응답 status 확인 후 data 읽기", summary: "9f8e7d6 · baek", author: "baek",
    body: "fix: 결제 응답 status 확인 후 data 읽기\n\n503일 때 data가 없어 KeyError 발생" }),

  // 기능 추가 (잡음)
  d({ id: "PR-11", date: "2026-11-12", type: "PR", title: "로그에서 인증 토큰 제거", summary: "#11 · 병합됨 · kim", author: "kim",
    body: "요청 로그에 Authorization 헤더가 그대로 찍히던 것을 제거했습니다. 보안 점검에서 지적된 사항입니다." }),
  d({ id: "COMMIT-0c1d2e3", date: "2026-11-01", type: "커밋", title: "chore: 초기 서버 구성", summary: "0c1d2e3 · baek", author: "baek",
    body: "chore: 초기 서버 구성\n\nFastAPI 서버, 회원·주문·통계·리포트·결제 API" }),
];
