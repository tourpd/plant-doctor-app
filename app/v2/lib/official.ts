// app/v2/lib/official.ts
// 공식 등록 자료(국립농산물품질관리원 "병해충별 자재 정보", 농식품 빅데이터 클라우드)를
// 포토닥터가 쓰는 라벨 형식으로 바꾼다. 숫자는 자료에 적힌 그대로만 쓴다.

export const OFFICIAL_SOURCE = "국립농산물품질관리원 병해충별 자재 정보";

/** 자료 한 줄 = 제품 × 작물 × 병해충 */
export type OfficialRow = {
  C_BRAND_NM?: string; // 상표명
  C_CO_NM?: string; // 회사
  C_ITEM_NM?: string; // 품목명(성분+제형)
  C_AGCHM_SE_NM?: string; // 일반농약 / 유기농자재
  A_PRPS_REGVL?: string; // 살충 / 살균 / 제초 …
  A_INTRCTN_MCHNSM_REGVL?: string; // 작용기작 표시기호
  C_MIRDNT_CONT_REGVL?: string; // 주성분 함량
  A_FRMLTN_REGVL?: string; // 제형
  A_MTXCTY_REGVL?: string; // 인축독성
  A_FTXCTY_REGVL?: string; // 어독성
  C_CROP_NM?: string;
  C_APLCN_DSINST_NM?: string; // 적용 병해충
  A_DLTN_MLTPL_REGVL?: string; // 희석배수
  C_USGQTY_REGVL?: string; // 사용량
  C_USE_PPRTM_REGVL?: string; // 사용 적기
  C_USE_MTHD_REGVL?: string; // 사용 방법
  A_SAFE_USE_ERA_REGVL?: string; // 안전사용 시기
  A_SAFE_USE_NOFTM_REGVL?: string; // 안전사용 횟수
};

export type OfficialUse = {
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

export type OfficialProduct = {
  readable: true;
  need_more: null;
  source: "official";
  variant: string; // 같은 상표의 여러 제형을 구분하는 말 (예: "수화제 10% · 바이엘크롭사이언스(주)")
  product_name: string;
  maker: string | null;
  category: string;
  ingredient: string | null;
  moa_code: string | null;
  summary: { where: string | null; how_much: string | null; when: string | null; caution: string | null };
  uses: OfficialUse[];
  my_use_index: number | null;
};

const s = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const blank = (v: string): boolean => v === "" || v === "-";

/** "1,000배 희석" → 1000 */
export function parseDilution(...texts: string[]): { text: string | null; x: number | null } {
  for (const t of texts) {
    const m = s(t).match(/([\d,]+(?:\.\d+)?)\s*배/);
    if (m) {
      const x = Number(m[1].replace(/,/g, ""));
      if (x > 0) return { text: `${x.toLocaleString("ko-KR")}배`, x };
    }
  }
  return { text: null, x: null };
}

/** "3㎏/10a" → { amount: 3, unit: "kg" }. 10a 기준이 아닌 표기(g/주, ℓ/㎡ 등)는 계산하지 않는다 */
export function parsePer10a(text: string): { amount: number | null; unit: string | null } {
  const m = s(text).match(/([\d.]+)\s*(㎏|kg|g|㎖|ml|mL|ℓ|L|l)\s*\/\s*10\s*a/);
  if (!m) return { amount: null, unit: null };
  const unit = ({ "㎏": "kg", "㎖": "ml", mL: "ml", "ℓ": "L", l: "L" } as Record<string, string>)[m[2]] ?? m[2];
  const amount = Number(m[1]);
  return amount > 0 ? { amount, unit } : { amount: null, unit: null };
}

/** "수확7일전" → 7 */
export function parsePhi(text: string): number | null {
  const m = s(text).match(/수확\s*(\d+)\s*일\s*전/);
  return m ? Number(m[1]) : null;
}

/** "3회" → 3 */
export function parseCount(text: string): number | null {
  const m = s(text).match(/(\d+)\s*회/);
  return m ? Number(m[1]) : null;
}

function categoryOf(r: OfficialRow): string {
  const p = s(r.A_PRPS_REGVL);
  if (p.includes("살충") || p === "균충") return p === "균충" ? "살균·살충제" : "살충제";
  if (p.includes("살균")) return "살균제";
  if (p.includes("제초")) return "제초제";
  if (s(r.C_AGCHM_SE_NM).includes("유기")) return "유기농업자재";
  return p ? p : "기타";
}

function toUse(r: OfficialRow): OfficialUse {
  const qty = s(r.C_USGQTY_REGVL);
  const dil = parseDilution(s(r.A_DLTN_MLTPL_REGVL), qty);
  const per = parsePer10a(qty);
  const era = s(r.A_SAFE_USE_ERA_REGVL);
  const phi = parsePhi(era);
  const timing = [
    s(r.C_USE_PPRTM_REGVL),
    s(r.C_USE_MTHD_REGVL),
    // 사용량이 희석배수도 10a 기준도 아니면(예: 2g/주) 글자 그대로 보여 준다
    !blank(qty) && dil.x === null && per.amount === null ? `사용량 ${qty}` : "",
    per.amount !== null ? `10a당 ${per.amount}${per.unit}` : "",
    // "정식기"처럼 수확 전 일수가 아닌 안전사용 시기는 글자 그대로
    !blank(era) && phi === null ? `${era}까지` : "",
  ]
    .filter((v) => !blank(v))
    .join(" · ");
  return {
    crop: s(r.C_CROP_NM),
    target: s(r.C_APLCN_DSINST_NM) || null,
    dilution: dil.text,
    dilution_x: dil.x,
    per_10a_amount: per.amount,
    per_10a_unit: per.unit,
    spray_l_per_10a: null,
    timing: timing || null,
    max_count: parseCount(s(r.A_SAFE_USE_NOFTM_REGVL)),
    phi_days: phi,
  };
}

const norm = (v: string): string => v.replace(/\s+/g, "");

function sameCrop(a: string, b: string): boolean {
  const x = norm(a);
  const y = norm(b);
  return x.length > 0 && y.length > 0 && (x.includes(y) || y.includes(x));
}

/** 자료 줄들을 제품(상표 + 품목 + 회사)별로 묶는다 */
export function rowsToProducts(rows: OfficialRow[], crop = ""): OfficialProduct[] {
  const groups = new Map<string, OfficialRow[]>();
  for (const r of rows) {
    const brand = s(r.C_BRAND_NM);
    if (!brand) continue;
    const key = [brand, s(r.C_ITEM_NM), s(r.C_MIRDNT_CONT_REGVL), s(r.C_CO_NM)].join("|");
    const list = groups.get(key);
    if (list) list.push(r);
    else groups.set(key, [r]);
  }

  const out: OfficialProduct[] = [];
  for (const list of groups.values()) {
    const first = list[0];
    const seen = new Set<string>();
    const uses: OfficialUse[] = [];
    for (const r of list) {
      const u = toUse(r);
      if (!u.crop) continue;
      const k = JSON.stringify(u);
      if (seen.has(k)) continue;
      seen.add(k);
      uses.push(u);
    }
    // 내 작물 줄을 맨 위로
    if (crop) uses.sort((a, b) => Number(sameCrop(b.crop, crop)) - Number(sameCrop(a.crop, crop)));

    const mine = crop ? uses.filter((u) => sameCrop(u.crop, crop)) : [];
    const crops = Array.from(new Set(uses.map((u) => u.crop)));
    const m0 = mine[0];
    const tox = [s(first.A_MTXCTY_REGVL) && `인축독성 ${s(first.A_MTXCTY_REGVL)}`, s(first.A_FTXCTY_REGVL) && `어독성 ${s(first.A_FTXCTY_REGVL)}`]
      .filter(Boolean)
      .join(", ");
    const frm = s(first.A_FRMLTN_REGVL);
    const cont = s(first.C_MIRDNT_CONT_REGVL);
    const maker = s(first.C_CO_NM) || null;

    out.push({
      readable: true,
      need_more: null,
      source: "official",
      variant: [[frm, cont].filter(Boolean).join(" ") || s(first.C_ITEM_NM), maker].filter(Boolean).join(" · "),
      product_name: s(first.C_BRAND_NM),
      maker,
      category: categoryOf(first),
      ingredient: [s(first.C_ITEM_NM), cont].filter(Boolean).join(" ") || null,
      moa_code: s(first.A_INTRCTN_MCHNSM_REGVL) || null,
      summary: {
        where:
          mine.length > 0
            ? `${crop}: ${Array.from(new Set(mine.map((u) => u.target).filter(Boolean))).slice(0, 6).join(", ") || "등록돼 있음"}`
            : crops.length > 0
              ? `등록 작물: ${crops.slice(0, 8).join(", ")}${crops.length > 8 ? ` 외 ${crops.length - 8}개` : ""}`
              : null,
        how_much: m0
          ? m0.dilution
            ? `물에 ${m0.dilution}로 타서`
            : m0.per_10a_amount !== null
              ? `10a(약 300평)에 ${m0.per_10a_amount}${m0.per_10a_unit}`
              : null
          : null,
        when: m0?.timing ?? null,
        caution:
          [
            m0 && m0.phi_days !== null ? `수확 ${m0.phi_days}일 전까지만` : "",
            m0 && m0.max_count !== null ? `${m0.max_count}회 이내` : "",
            tox,
          ]
            .filter(Boolean)
            .join(" · ") || null,
      },
      uses,
      my_use_index: mine.length > 0 ? 0 : null,
    });
  }

  // 내 작물에 등록된 제품, 사용 줄이 많은 제품이 먼저
  out.sort(
    (a, b) => Number(b.my_use_index !== null) - Number(a.my_use_index !== null) || b.uses.length - a.uses.length
  );
  return out;
}

/** 사진에서 읽은 글자(제형·회사)로 같은 상표의 여러 제품 중 맞는 것을 고른다. 못 고르면 -1 */
export function pickVariant(products: OfficialProduct[], hint: string): number {
  if (products.length === 1) return 0;
  const h = norm(hint);
  if (!h) return -1;
  // 긴 제형 이름부터 비교한다 ("액상수화제"가 "수화제"보다 먼저)
  const scored = products.map((p, i) => {
    const frm = norm(p.variant.split("·")[0].replace(/[\d.%()+]/g, ""));
    const maker = norm((p.maker ?? "").replace(/\(주\)|㈜|주식회사/g, ""));
    let score = 0;
    if (frm && h.includes(frm)) score += 10 + frm.length;
    if (maker && h.includes(maker)) score += 5;
    return { i, score };
  });
  scored.sort((a, b) => b.score - a.score);
  if (scored[0].score === 0) return -1;
  if (scored.length > 1 && scored[0].score === scored[1].score) return -1;
  return scored[0].i;
}
