// app/v2/lib/officialFetch.ts  (서버에서만 쓴다)
// 농식품 빅데이터 클라우드의 "병해충별 자재 정보"를 상표명으로 찾는다.
// 인증키는 Vercel 환경변수 MAFRA_API_KEY 에만 둔다.
import { findMakerForTarget, findMakerProducts } from "./makerProducts";
import { matchUseIndex } from "./logic";
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

/** 자료 서버에 걸러 찾기 조건(필드=값)을 넣어 줄을 받아 온다. 같은 조건은 6시간 기억 */
async function fetchRowsBy(filters: Record<string, string>): Promise<OfficialRow[]> {
  const cacheKey = JSON.stringify(filters);
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.rows;

  const key = process.env.MAFRA_API_KEY as string;
  const query = Object.entries(filters)
    .map(([k, v]) => `&${k}=${encodeURIComponent(v)}`)
    .join("");
  const url = `${ENDPOINT}?apiNo=${API_NO}&apiKey=${encodeURIComponent(key)}&startIndex=0&endIndex=1000${query}`;
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
    cache.set(cacheKey, { at: Date.now(), rows });
    return rows;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchRows(name: string): Promise<OfficialRow[]> {
  return fetchRowsBy({ C_BRAND_NM: name });
}

/** 상표명(일부만 넣어도 됨)으로 공식 등록 제품을 찾는다 */
export async function findOfficial(rawName: string, crop = ""): Promise<OfficialResult> {
  // 영양제·비료처럼 공식 등록 자료에 없는 제품은 제조사 자료에서 먼저 찾는다 (열쇠가 없어도 된다)
  const maker = findMakerProducts(cleanName(rawName), crop);
  if (maker.length > 0) return { ok: true, products: maker };
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

/** 진단에서 나온 병해충 이름을 자료 검색어로 다듬는다 ("고추 탄저병(Colletotrichum)" → "탄저병") */
export function cleanTarget(raw: string, crop = ""): string {
  let v = raw.replace(/\(.*?\)/g, " ").replace(/[^가-힣0-9\s]/g, " ");
  if (crop) v = v.replace(new RegExp(crop.replace(/\s+/g, ""), "g"), " ");
  v = v.replace(/\s+/g, "").replace(/(의심|추정|가능성)$/, "");
  return v.slice(0, 20);
}

export type TargetResult =
  | { ok: true; target: string; products: OfficialProduct[] }
  | { ok: false; code: "no-key" | "bad-name" | "upstream"; detail?: string; products: OfficialProduct[] };

/**
 * 내 작물 + 병해충 이름으로 "등록된 약"을 찾는다 (사진 진단의 처방용).
 * 제품마다 my_use_index를 그 병해충 줄에 맞춰 둔다.
 */
export async function findForTarget(crop: string, rawTarget: string): Promise<TargetResult> {
  const target = cleanTarget(rawTarget, crop);
  const c = crop.replace(/\s+/g, "");
  // 제조사 자료(도프 등)는 열쇠 없이도 찾는다
  const maker = findMakerForTarget(crop, target);
  if (target.length < 2 || c.length < 1) return { ok: false, code: "bad-name", products: maker };
  if (!process.env.MAFRA_API_KEY) return { ok: false, code: "no-key", products: maker };
  try {
    const rows = await fetchRowsBy({ C_CROP_NM: c, C_APLCN_DSINST_NM: target });
    const products = rowsToProducts(rows, crop).map((p) => {
      const i = p.uses.findIndex((u) => matchUseIndex([u], crop) === 0 && (u.target ?? "").replace(/\s+/g, "").includes(target));
      return { ...p, my_use_index: i >= 0 ? i : p.my_use_index };
    });
    return { ok: true, target, products: [...maker, ...products] };
  } catch (e) {
    const msg = String((e as { message?: string })?.message ?? e);
    return {
      ok: false,
      code: "upstream",
      detail: msg.replace(/apiKey=[^&\s]+/g, "apiKey=***").slice(0, 160),
      products: maker,
    };
  }
}
