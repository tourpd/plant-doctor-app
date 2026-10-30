// NCPMS 전문가 상담 사례 검색 — 비슷한 증상 사례 찾기
import fs from "node:fs";
import path from "node:path";

export type ExpertCase = {
  id: number; crop: string; realm: string; sido: string; sigungu: string; month: string;
  part: string; symptom: string; category: string; pest: string; opinion: string; control: string; images: string[];
};
let CACHE: { cases: ExpertCase[]; vecs: Float32Array; dims: number } | null | undefined;

function load() {
  if (CACHE !== undefined) return CACHE;
  try {
    const dir = path.join(process.cwd(), "app/data/knowledge");
    const c = JSON.parse(fs.readFileSync(path.join(dir, "ncpms_cases.json"), "utf8"));
    const v = JSON.parse(fs.readFileSync(path.join(dir, "ncpms_vectors.json"), "utf8"));
    const buf = Buffer.from(v.b64, "base64");
    const vecs = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
    CACHE = c.cases?.length === v.count ? { cases: c.cases, vecs, dims: v.dims } : null;
  } catch {
    CACHE = null;
  }
  return CACHE;
}

const ALIAS: Record<string, string[]> = {
  호박: ["호박", "애호박", "단호박", "주키니"], 무: ["무", "알타리", "총각무", "가을무", "열무"], 파: ["파", "대파", "쪽파"],
  감귤: ["감귤", "귤", "한라봉", "온주밀감"], 참다래: ["참다래", "키위"], 토마토: ["토마토", "방울토마토"], 고추: ["고추", "풋고추", "청양고추"],
};
function cropKeys(crop: string): string[] {
  const c = String(crop || "").replace(/\s|잎|\(.*\)/g, "");
  for (const [k, list] of Object.entries(ALIAS)) if (list.some((a) => c.includes(a) || a.includes(c))) return list;
  return c ? [c] : [];
}

export async function findSimilarCases(crop: string, queryText: string, k = 5): Promise<ExpertCase[]> {
  const db = load();
  const key = process.env.OPENAI_API_KEY;
  if (!db || !key || !queryText) return [];
  try {
    const r = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: "text-embedding-3-small", dimensions: db.dims, input: queryText.slice(0, 2000) }),
      signal: AbortSignal.timeout(8000),
    });
    const q: number[] = (await r.json())?.data?.[0]?.embedding;
    if (!q) return [];
    const keys = cropKeys(crop);
    const same = (c: ExpertCase) => keys.some((x) => c.crop.includes(x));
    const scored: { i: number; s: number }[] = [];
    for (let i = 0; i < db.cases.length; i++) {
      let s = 0;
      const o = i * db.dims;
      for (let d = 0; d < db.dims; d++) s += q[d] * db.vecs[o + d];
      if (same(db.cases[i])) s += 0.08; // 같은 작물 우대
      scored.push({ i, s });
    }
    scored.sort((a, b) => b.s - a.s);
    // 답이 "불명/기타"뿐인 사례는 근거로 약하므로 뒤로
    const good = scored.filter((x) => !/불명|기타/.test(db.cases[x.i].category || "") || db.cases[x.i].pest);
    return good.slice(0, k).map((x) => db.cases[x.i]);
  } catch {
    return [];
  }
}

/** 사례 사진을 서버에서 받아 data URL 로 (실패하면 건너뜀) */
export async function fetchImageDataUrl(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return null;
    const type = r.headers.get("content-type") || "image/jpeg";
    if (!type.startsWith("image/")) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 2000 || buf.length > 3_000_000) return null;
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
