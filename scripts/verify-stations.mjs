// 관측소 번호가 맞는지 기상청 응답의 관측소 이름으로 대조
import fs from "node:fs";
const env = {}; for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m) env[m[1]] = m[2]; }
if (!env.DATA_GO_KR_KEY) { console.log("⚠️ DATA_GO_KR_KEY 없음 — 날씨 생략"); process.exit(0); }
const src = fs.readFileSync("lib/evidence/stations.ts", "utf8");
const block = src.slice(src.indexOf("ASOS"), src.indexOf("};"));
const pairs = [...block.matchAll(/([가-힣]+):\s*(\d+)/g)].map((m) => [m[1], +m[2]]);
const d = new Date(Date.now() - 3 * 86400e3).toISOString().slice(0, 10).replace(/-/g, "");
const bad = [];
for (const [name, id] of pairs) {
  const u = `http://apis.data.go.kr/1360000/AsosDalyInfoService/getWthrDataList?serviceKey=${encodeURIComponent(env.DATA_GO_KR_KEY)}&numOfRows=1&pageNo=1&dataType=JSON&dataCd=ASOS&dateCd=DAY&startDt=${d}&endDt=${d}&stnIds=${id}`;
  try {
    const j = await (await fetch(u, { signal: AbortSignal.timeout(8000) })).json();
    const it = [].concat(j?.response?.body?.items?.item || [])[0];
    const got = it?.stnNm || "(없음:" + (j?.response?.header?.resultMsg || "응답없음") + ")";
    if (!String(got).startsWith(name.slice(0, 2))) bad.push(`${name}=${id} → ${got}`);
  } catch (e) { bad.push(`${name}=${id} → 오류 ${e.message}`); }
}
fs.writeFileSync("scripts/out/stations_check.txt", `확인 ${pairs.length}곳, 불일치 ${bad.length}곳\n` + bad.join("\n") + "\n");
console.log(`관측소 확인 ${pairs.length}곳, 불일치 ${bad.length}곳`); bad.forEach((b) => console.log("  ⚠️ " + b));
