// NCPMS 병해충상담(전문가 답변) 사례 수집 → 검색 색인 만들기
// 결과: app/data/knowledge/ncpms_cases.json (사례) + ncpms_vectors.json (임베딩)
import fs from "node:fs";
const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m) env[m[1]] = m[2].replace(/^"(.*)"$/s, "$1");
}
const KEY = env.NCPMS_API_KEY, OPENAI = env.OPENAI_API_KEY;
if (!KEY) { console.error("❌ NCPMS_API_KEY 없음"); process.exit(1); }
const LOG = "scripts/out/build_cases.log"; fs.mkdirSync("scripts/out", { recursive: true });
const log = (s) => { console.log(s); fs.appendFileSync(LOG, s + "\n"); };
fs.writeFileSync(LOG, `시작 ${new Date().toString()}\n`);
const BASE = "http://ncpms.rda.go.kr/npmsAPI/service";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(params, tries = 3) {
  const u = `${BASE}?apiKey=${encodeURIComponent(KEY)}&serviceType=AA003&${new URLSearchParams(params)}`;
  for (let t = 0; t < tries; t++) {
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(20000) });
      const j = await r.json();
      return j.service || j;
    } catch (e) { await sleep(1500 * (t + 1)); }
  }
  return null;
}
const CROPS = ["고추","토마토","오이","딸기","배추","상추","들깨","참깨","파","양파","마늘","무","호박","수박","참외","멜론","감자","고구마","옥수수","콩","녹두","팥","벼","사과","배","복숭아","포도","감귤","유자","참다래","키위","블루베리","감","자두","매실","가지","시금치","양배추","브로콜리","생강","인삼","부추","쪽파","대파","배추","들깨","녹차","밀","보리","땅콩","당근","파프리카","피망","국화","장미"];
const seen = new Map();
for (const crop of [...new Set(CROPS)]) {
  let start = 1, total = 0, got = 0;
  do {
    const s = await api({ serviceCode: "SVC41", cropName: crop, displayCount: 50, startPoint: start });
    if (!s) { log(`  ⚠️ ${crop} ${start} 실패`); break; }
    total = Number(s.totalCount || 0);
    const items = Array.isArray(s.list) ? s.list : (s.list?.item ? [].concat(s.list.item) : []);
    for (const it of items) if (it?.dgnssReqNo && !seen.has(it.dgnssReqNo)) { seen.set(it.dgnssReqNo, it); got++; }
    start += 50;
    await sleep(150);
  } while (start <= Math.min(total, 500));
  log(`${crop}: 검색 ${total}건, 새로 ${got}건 (누적 ${seen.size})`);
}
const clean = (s, n) => String(s || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/0\d{1,2}[-\s.]?\d{3,4}[-\s.]?\d{4}/g, "[번호]").replace(/\s+/g, " ").trim().slice(0, n);
const cases = [];
let i = 0;
for (const [no] of seen) {
  i++;
  const d = await api({ serviceCode: "SVC42", dgnssReqNo: no });
  await sleep(120);
  if (!d || !(d.dgnssOpin || d.dbyhs || d.answerSe)) continue;
  const imgs = [].concat(d.imageList?.image || d.imageList || []).map((x) => (typeof x === "string" ? x : x?.image || x?.imageUrl || "")).filter(Boolean);
  cases.push({
    id: no, crop: clean(d.cropName, 30), realm: clean(d.realm, 20),
    sido: clean(d.sidoName, 20), sigungu: clean(d.sigunguName, 20),
    month: String(d.registDatetm || "").slice(0, 7),
    part: clean(d.priyClName, 40), symptom: clean(d.reqestCn, 400),
    category: clean(d.answerSe, 20), pest: clean(d.dbyhs, 60),
    opinion: clean(d.dgnssOpin, 500), control: clean(d.prvnbeMth, 300),
    images: imgs.slice(0, 3),
  });
  if (i % 200 === 0) log(`상세 ${i}/${seen.size} (답변 있는 사례 ${cases.length})`);
}
fs.writeFileSync("app/data/knowledge/ncpms_cases.json", JSON.stringify({ builtAt: new Date().toISOString(), source: "NCPMS 병해충상담 Open API (SVC41/42)", cases }));
log(`✅ 사례 ${cases.length}건 저장 (사진 있는 사례 ${cases.filter((c) => c.images.length).length}건)`);

// 임베딩 (text-embedding-3-small, 256차원)
if (!OPENAI) { log("⚠️ OPENAI_API_KEY 없음 — 임베딩 생략"); process.exit(0); }
const texts = cases.map((c) => `${c.crop} | 부위: ${c.part} | 증상: ${c.symptom} | 전문가: ${c.category} ${c.pest} | ${c.opinion.slice(0, 250)}`);
const vecs = [];
for (let s = 0; s < texts.length; s += 100) {
  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI}` },
    body: JSON.stringify({ model: "text-embedding-3-small", dimensions: 256, input: texts.slice(s, s + 100) }),
  });
  const j = await r.json();
  if (!j.data) { log("❌ 임베딩 실패: " + JSON.stringify(j).slice(0, 200)); process.exit(1); }
  for (const d of j.data) vecs.push(...d.embedding.map((x) => Math.round(x * 10000) / 10000));
}
const f32 = new Float32Array(vecs);
fs.writeFileSync("app/data/knowledge/ncpms_vectors.json", JSON.stringify({ model: "text-embedding-3-small", dims: 256, count: cases.length, b64: Buffer.from(f32.buffer).toString("base64") }));
log(`✅ 임베딩 ${cases.length}건 저장`);
