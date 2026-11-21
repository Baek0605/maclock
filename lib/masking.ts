// 민감정보 마스킹 (개인 프로젝트 masking.py 규칙을 옮긴 것)
// AI가 아니라 코드로 처리한다. 누가 몇 번 돌려도 같은 결과가 나와야 하므로.

type Rule = { name: string; pattern: RegExp; replace: string };

// 위에서부터 순서대로 적용한다
const RULES: Rule[] = [
  // Authorization: Bearer <토큰>
  { name: "BEARER_TOKEN", pattern: /(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/g, replace: "$1[TOKEN_MASKED]" },
  // sk-로 시작하는 API 키
  { name: "API_KEY", pattern: /\bsk-[A-Za-z0-9\-_]{8,}/g, replace: "[API_KEY_MASKED]" },
  // GitHub 토큰
  { name: "GITHUB_TOKEN", pattern: /\b(ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{10,}/g, replace: "[GITHUB_TOKEN_MASKED]" },
  // 접속 주소 안의 비밀번호  scheme://user:password@host
  {
    name: "URL_PASSWORD",
    pattern: /(\b[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^:/\s]+:)[^@\s]+(@)/g,
    replace: "$1[PASSWORD_MASKED]$2",
  },
  // password=..., token=..., secret=..., api_key=... (이미 가린 값은 건너뜀)
  {
    name: "KEY_VALUE",
    pattern: /\b(password|passwd|pwd|token|secret|api_key|apikey)=(?!\[)([^\s,&"']+)/gi,
    replace: "$1=[SECRET_MASKED]",
  },
  // 이메일
  { name: "EMAIL", pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, replace: "[EMAIL_MASKED]" },
  // 휴대폰 번호 (010-1234-5678)
  { name: "PHONE", pattern: /\b01[016789]-?\d{3,4}-?\d{4}\b/g, replace: "[PHONE_MASKED]" },
];

export function mask(text: string): { text: string; counts: Record<string, number> } {
  const counts: Record<string, number> = {};
  let out = text;
  for (const rule of RULES) {
    out = out.replace(rule.pattern, (...args) => {
      counts[rule.name] = (counts[rule.name] ?? 0) + 1;
      // "$1" 같은 치환을 직접 처리
      const groups = args.slice(1, -2) as string[];
      return rule.replace.replace(/\$(\d)/g, (_, n) => groups[Number(n) - 1] ?? "");
    });
  }
  return { text: out, counts };
}
