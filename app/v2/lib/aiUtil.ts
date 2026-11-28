// app/v2/lib/aiUtil.ts  (서버에서만 쓴다)
// OpenAI 응답·오류를 다루는 공통 도움 함수 (라벨 읽기·사진 진단이 같이 쓴다)

export function safeJsonParse(raw: string): unknown {
  const text = (raw || "").trim();
  try {
    return JSON.parse(text);
  } catch {}
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) return JSON.parse(text.slice(start, end + 1));
  throw new Error("JSON 파싱 실패");
}

/** OpenAI 오류의 세부 코드 (insufficient_quota, rate_limit_exceeded 등) */
export function errCode(e: unknown): string {
  const x = e as { code?: string; type?: string; error?: { code?: string; type?: string } };
  return x?.code || x?.error?.code || x?.type || x?.error?.type || "";
}

/** OpenAI 계정에 설정한 지출 한도에 걸린 경우 (기다려도 풀리지 않는다) */
export function isSpendLimit(e: unknown): boolean {
  return /spend limit|hard limit|billing/i.test(String((e as { message?: string })?.message ?? ""));
}

/** 원인 파악용 짧은 설명. 조직 번호·열쇠처럼 보이는 글자는 지운다 */
export function errDetail(e: unknown): string {
  const msg = String((e as { message?: string })?.message ?? "");
  return msg
    .replace(/org-[A-Za-z0-9]+/g, "org-***")
    .replace(/sk-[A-Za-z0-9_-]+/g, "sk-***")
    .replace(/\s+/g, " ")
    .slice(0, 220);
}

/** AI가 실패했을 때 농민에게 보여 줄 말과 코드 */
export function aiFailure(e: unknown, what: string): { code: string; error: string; detail: string } {
  const status = (e as { status?: number })?.status;
  const budget = isSpendLimit(e);
  const quota = !budget && errCode(e) === "insufficient_quota";
  return {
    code: budget ? "ai-budget" : quota ? "ai-quota" : status === 429 ? "ai-busy" : `ai-${status ?? "fail"}`,
    detail: errDetail(e),
    error: budget
      ? `AI(OpenAI) 계정에 정해 둔 월 사용 한도를 다 써서 ${what} 수 없습니다. 한도를 올리거나 다음 달까지 기다려야 합니다.`
      : quota
        ? `AI 이용 요금(충전금)이 떨어졌거나 결제 한도에 걸려 ${what} 수 없습니다.`
        : status === 401
          ? "AI 열쇠가 맞지 않습니다."
          : status === 429
            ? "지금 AI 요청이 몰려 있습니다. 1분쯤 뒤에 다시 해 주세요."
            : `AI가 ${what.replace(/ 수$/, "")}지 못했습니다. 다시 해 주세요.`,
  };
}
