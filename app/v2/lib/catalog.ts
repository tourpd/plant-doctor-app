// app/v2/lib/catalog.ts  (서버 전용)
// 국립농산물품질관리원 "병해충별 자재 정보"(농식품 빅데이터 클라우드, ax.mafra.go.kr)에서
// 상표명으로 사용법 표를 찾는다. 상표(앞면)만 찍어도 처방이 나오게 하는 것이 목적이다.
//
// 인증키: Vercel 환경변수 MAFRA_API_KEY (대표님이 직접 넣는다. 코드·대화에 적지 않는다)
// 자료 번호: MAFRA_PEST_API_NO (기본 API000000070)
//
// 자료의 항목 이름은 승인 뒤 실제로 받아 봐야 확정된다. 그래서 항목 이름 후보를 넓게 두고,
// /api/v2/product?check=1 로 첫 줄의 항목 이름을 확인해 아래 KEYS 만 고치면 되게 했다.

const BASE = "https://ax.mafra.go.kr/portal/apiRequest";
const PAGE = 1000; // 한 번에 받는 줄 수
const MAX_PAGES = 40; // 약 2만 건 + 여유
const TTL_MS = 24 * 60 * 60 * 1000; // 하루에 한 번만 새로 받는다

export type CatalogUse = {
  crop: string;
  target: string | null;
  dilution: string | null;
  dilution_x: number | null;
  per_10a_amount: number | null;
  per_10a_unit: string | null;
  spray_l_per_10a: number | null;
  timing: string | null;
  max_count: number | null;
  phi_days: number | null;
};

export type CatalogItem = {
  name: string;
  maker: string | null;
  category: string;
  ingredient: string | null;
  moa_code: string | null;
  uses: CatalogUse[];
};

type Row = Record<string, unknown>;

// 항목 이름 후보 (영문 약어·우리말 둘 다). 앞에 있는 것이 먼저 쓰인다.
const KEYS = {
  brand: ["brandName", "brand_nm", "brndNm", "BRAND_NM", "상표명", "제품명", "prdlstNm", "productName"],
  item: ["pestiKorName", "cpntkor", "prdlst_nm", "PRDLST_NM", "품목명", "농약명", "자재명"],
  maker: ["compName", "cmpnyNm", "CMPNY_NM", "entrpsNm", "회사명", "업체명", "제조사", "제조업체"],
  kind: ["useName", "prposNm", "PRPOS_NM", "용도", "용도명", "농약용도", "구분"],
  ingredient: ["engName", "ingrNm", "성분", "주성분", "유효성분", "성분명"],
  moa: ["indictSymbl", "moaCode", "작용기작", "작용기작표시", "표시기호"],
  crop: ["cropName", "cropNm", "CROP_NM", "작물명", "적용작물", "작물"],
  target: ["diseaseWeedName", "dsstNm", "sickNm", "병해충명", "적용병해충", "병해충", "대상"],
  dilution: ["dilutUnit", "dilutNm", "희석배수", "희석", "사용량", "희석배수사용량"],
  timing: ["useSuittime", "useTime", "사용시기", "사용적기"],
  count: ["useNum", "useCnt", "사용횟수", "횟수"],
  phi: ["safeUseDay", "phiDay", "수확전사용일", "안전사용기준", "수확전일수"],
};

const norm = (s: string) => s.toLowerCase().replace(/[^0-9a-z가-힣]/g, "");

/** 줄에서 후보 항목 이름 중 처음 값이 있는 것을 꺼낸다 (대소문자·밑줄 무시) */
function pick(row: Row, cands: string[]): string | null {
  const map = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) map.set(norm(k), v);
  for (const c of cands) {
    const v = map.get(norm(c));
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

/** 응답 모양을 모르므로, 안에서 처음 나오는 "객체 배열"을 자료 줄로 본다 */
export function extractRows(data: unknown, depth = 0): Row[] {
  if (depth > 5 || !data || typeof data !== "object") return [];
  if (Array.isArray(data)) {
    if (data.length > 0 && data.every((x) => x && typeof x === "object" && !Array.isArray(x))) return data as Row[];
    for (const x of data) {
      const r = extractRows(x, depth + 1);
      if (r.length) return r;
    }
    return [];
  }
  for (const v of Object.values(data as Row)) {
    const r = extractRows(v, depth + 1);
    if (r.length) return r;
  }
  return [];
}

function num(s: string | null): number | null {
  if (!s) return null;
  const m = s.replace(/,/g, "").match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

/** "1,000배" → 1000. "배"가 없으면 희석배수로 보지 않는다 */
function dilutionX(s: string | null): number | null {
  if (!s || !/배/.test(s)) return null;
  return num(s);
}

/** 사용 시기 글에서 "수확 7일 전까지" 같은 숫자 */
function phiFrom(s: string | null): number | null {
  if (!s) return null;
  const m = s.replace(/\s/g, "").match(/수확(\d+)일전/);
  return m ? Number(m[1]) : null;
}

function categoryOf(kind: string | null, item: string | null): string {
  const t = `${kind ?? ""} ${item ?? ""}`;
  if (/살충/.test(t)) return "살충제";
  if (/살균/.test(t)) return "살균제";
  if (/제초/.test(t)) return "제초제";
  if (/비료/.test(t)) return "비료";
  if (/영양|생장|생육/.test(t)) return "영양제";
  return "기타";
}

function apiUrl(start: number, end: number): string {
  const no = process.env.MAFRA_PEST_API_NO || "API000000070";
  const key = process.env.MAFRA_API_KEY || "";
  return `${BASE}?apiNo=${encodeURIComponent(no)}&apiKey=${encodeURIComponent(key)}&startIndex=${start}&endIndex=${end}`;
}

async function fetchPage(start: number, end: number): Promise<Row[]> {
  const res = await fetch(apiUrl(start, end), { cache: "no-store", signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`공식 자료 HTTP ${res.status}`);
  const text = await res.text();
  try {
    return extractRows(JSON.parse(text));
  } catch {
    throw new Error("공식 자료가 JSON이 아닙니다: " + text.slice(0, 120));
  }
}

export function catalogConfigured(): boolean {
  return !!process.env.MAFRA_API_KEY;
}

// ───── 서버 메모리에 하루 보관 ─────
type Cache = { at: number; items: Map<string, CatalogItem>; rows: number };
let cache: Cache | null = null;
let loading: Promise<Cache> | null = null;

function buildIndex(rows: Row[]): Map<string, CatalogItem> {
  const items = new Map<string, CatalogItem>();
  for (const r of rows) {
    const name = pick(r, KEYS.brand) ?? pick(r, KEYS.item);
    if (!name) continue;
    const key = norm(name);
    let it = items.get(key);
    if (!it) {
      const item = pick(r, KEYS.item);
      it = {
        name,
        maker: pick(r, KEYS.maker),
        category: categoryOf(pick(r, KEYS.kind), item),
        ingredient: pick(r, KEYS.ingredient) ?? (item && item !== name ? item : null),
        moa_code: pick(r, KEYS.moa),
        uses: [],
      };
      items.set(key, it);
    }
    const crop = pick(r, KEYS.crop);
    if (!crop) continue;
    const dilution = pick(r, KEYS.dilution);
    const timing = pick(r, KEYS.timing);
    it.uses.push({
      crop,
      target: pick(r, KEYS.target),
      dilution,
      dilution_x: dilutionX(dilution),
      per_10a_amount: null, // 공식 자료 형식을 본 뒤 채운다
      per_10a_unit: null,
      spray_l_per_10a: null,
      timing,
      max_count: num(pick(r, KEYS.count)),
      phi_days: num(pick(r, KEYS.phi)) ?? phiFrom(timing),
    });
  }
  return items;
}

async function load(): Promise<Cache> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache;
  if (loading) return loading;
  loading = (async () => {
    const rows: Row[] = [];
    // 4쪽씩 나란히 받는다
    for (let p = 0; p < MAX_PAGES; p += 4) {
      const pages = await Promise.all(
        [0, 1, 2, 3].map((i) => {
          const start = (p + i) * PAGE;
          return fetchPage(start, start + PAGE - 1).catch((e) => {
            if (p + i === 0) throw e; // 첫 쪽부터 안 되면 키·주소 문제
            return [] as Row[];
          });
        })
      );
      for (const pg of pages) rows.push(...pg);
      // endIndex가 포함인지 아닌지 아직 모르므로, 빈 쪽이 나올 때 멈춘다.
      // (한 번에 주는 줄 수가 PAGE보다 적게 막혀 있으면 ?check=1 의 firstPageRows·total 로 드러난다)
      if (pages.some((pg) => pg.length === 0)) break;
    }
    cache = { at: Date.now(), items: buildIndex(rows), rows: rows.length };
    return cache;
  })().finally(() => {
    loading = null;
  });
  return loading;
}

/** 이름 두세 글자로 후보 목록 */
export async function searchNames(q: string, limit = 12): Promise<{ name: string; maker: string | null; category: string }[]> {
  const nq = norm(q);
  if (nq.length < 2 || !catalogConfigured()) return [];
  const { items } = await load();
  const starts: CatalogItem[] = [];
  const contains: CatalogItem[] = [];
  for (const [k, it] of items) {
    if (k.startsWith(nq)) starts.push(it);
    else if (k.includes(nq)) contains.push(it);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains]
    .slice(0, limit)
    .map((it) => ({ name: it.name, maker: it.maker, category: it.category }));
}

/** 상표명으로 제품 하나 찾기. 정확히 같은 이름이 없으면, 하나로만 좁혀질 때만 돌려준다 */
export async function findProduct(name: string): Promise<CatalogItem | null> {
  const nq = norm(name);
  if (nq.length < 2 || !catalogConfigured()) return null;
  const { items } = await load();
  const exact = items.get(nq);
  if (exact) return exact;
  const near = [...items.entries()].filter(([k]) => k.includes(nq) || (k.length >= 3 && nq.includes(k)));
  return near.length === 1 ? near[0][1] : null;
}

/** 승인 뒤 자료 형식 확인용: 첫 줄과 받은 건수 */
export async function checkCatalog(): Promise<{ configured: boolean; sample?: Row; firstPageRows?: number; total?: number; products?: number; error?: string }> {
  if (!catalogConfigured()) return { configured: false };
  try {
    const first = await fetchPage(0, 2);
    const c = await load();
    return { configured: true, sample: first[0], firstPageRows: first.length, total: c.rows, products: c.items.size };
  } catch (e) {
    return { configured: true, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 내 작물 줄 번호 (없으면 null) */
export function cropIndex(uses: CatalogUse[], crop: string): number | null {
  const c = norm(crop);
  if (!c) return null;
  const i = uses.findIndex((u) => norm(u.crop) === c);
  if (i >= 0) return i;
  const j = uses.findIndex((u) => norm(u.crop).includes(c) || c.includes(norm(u.crop)));
  return j >= 0 ? j : null;
}

/** 라벨 화면이 쓰는 모양으로 바꾼다 */
export function toLabel(it: CatalogItem, crop: string) {
  const idx = cropIndex(it.uses, crop);
  const mine = idx !== null ? it.uses[idx] : null;
  return {
    readable: true,
    need_more: it.uses.length === 0 ? "공식 자료에 사용법 표가 없습니다. 뒷면 사용법 표를 찍어 주세요" : null,
    product_name: it.name,
    maker: it.maker,
    category: it.category,
    ingredient: it.ingredient,
    moa_code: it.moa_code,
    summary: {
      where: mine
        ? `${mine.crop}${mine.target ? ` · ${mine.target}` : ""}`
        : it.uses.length > 0 && crop
          ? `공식 자료에 ${crop}은 없습니다`
          : null,
      how_much: mine?.dilution ?? null,
      when: mine?.timing ?? null,
      caution: null,
    },
    uses: it.uses,
    my_use_index: idx,
    source: "국립농산물품질관리원 공식 자료",
  };
}
