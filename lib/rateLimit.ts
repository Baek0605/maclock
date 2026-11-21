// 아주 단순한 요청 횟수 제한 (같은 IP 기준, 1분 창)
// 서버가 여러 대로 나뉘는 배포 환경에서는 대략적인 보호만 된다. 예산 보호용 최소 장치.

const hits = new Map<string, number[]>();

export function allow(key: string, limit: number, windowMs = 60_000): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

export function clientKey(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}
