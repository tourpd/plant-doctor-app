// app/v2/lib/officialFetch.ts  (서버에서만 쓴다)
// 농식품 빅데이터 클라우드의 "병해충별 자재 정보"를 상표명으로 찾는다.
// 인증키는 Vercel 환경변수 MAFRA_API_KEY 에만 둔다.
import { rowsToProducts } from "./official";
import type { OfficialProduct, OfficialRow } from "./official";

// 시험할 때만 MAFRA_API_URL로 바꾼다
const ENDPOINT = process.env.MAFRA_API_URL || "https://ax.mafra.go.kr/portal/apiRequest";
const API_NO = "API000000070";
const TTL_MS = 6 * 60 * 60 * 1000; // 등록 자료는 자주 바뀌지 않아 6시간 기억해 둔다
const cache = new Map<string, { at: number; rows: OfficialRow[] }>();

export type OfficialResult =
  | { ok: true; products: OfficialProduct[] }
  | { ok: false; code: "no-key" | "bad-name" | "upstream"; detail?: string };

/** 검색어 정리: 줄바꿈·기호를 빼고 30자까지 */
export function cleanName(v: string): string {
  return v.replace(/[\r\n\t]/g, " ").replace(/[^0-9A-Za-z가-힣ㄱ-ㅎ\s\-+.]/g, "").trim().slice(0, 30);
}

async function fetchRows(name: string): Promise<OfficialRow[]> {
  const hit = cache.get(name);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.rows;

  const key = process.env.MAFRA_API_KEY as string;
  const url =
    `${ENDPOINT}?apiNo=${API_NO}&apiKey=${encodeURIComponent(key)}` +
    `&startIndex=0&endIndex=1000&C_BRAND_NM=${encodeURIComponent(name)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    const json = (await res.json()) as {
      header?: unknown;
      body?: { items?: OfficialRow[] | null };
    };
    const head = json?.header;
    if (typeof head === "object" && head !== null) {
      const h = head as { rspdCd?: string; rspdMsgCn?: string };
      throw new Error(`자료 서버 응답 ${h.rspdCd ?? ""} ${h.rspdMsgCn ?? ""}`.trim());
    }
    const rows = Array.isArray(json?.body?.items) ? json.body.items : [];
    if (cache.size > 300) cache.clear();
    cache.set(name, { at: Date.now(), rows });
    return rows;
  } finally {
    clearTimeout(timer);
  }
}

/** 상표명(일부만 넣어도 됨)으로 공식 등록 제품을 찾는다 */
export async function findOfficial(rawName: string, crop = ""): Promise<OfficialResult> {
  if (!process.env.MAFRA_API_KEY) return { ok: false, code: "no-key" };
  const name = cleanName(rawName).replace(/\s+/g, "");
  if (name.length < 2) return { ok: false, code: "bad-name" };
  try {
    let rows = await fetchRows(name);
    // 띄어 쓴 상표("싹쓰리충 골드")는 붙여 쓴 말로는 안 나오므로 원래 띄어쓰기로 한 번 더 찾는다
    const spaced = cleanName(rawName).replace(/\s+/g, " ");
    if (rows.length === 0 && spaced !== name) rows = await fetchRows(spaced);
    const products = rowsToProducts(rows, crop);
    // 이름이 똑같은 제품을 먼저
    const same = (p: OfficialProduct) => p.product_name.replace(/\s+/g, "") === name;
    products.sort((a, b) => Number(same(b)) - Number(same(a)));
    return { ok: true, products };
  } catch (e) {
    const msg = String((e as { message?: string })?.message ?? e);
    return { ok: false, code: "upstream", detail: msg.replace(/apiKey=[^&\s]+/g, "apiKey=***").slice(0, 160) };
  }
}
