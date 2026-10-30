// 기상청 ASOS 응답 원문 확인 (열쇠는 가려서 출력)
import fs from "node:fs";
const env = {}; for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m) env[m[1]] = m[2]; }
const k = env.DATA_GO_KR_KEY || "";
const d = new Date(Date.now() - 3 * 86400e3).toISOString().slice(0, 10).replace(/-/g, "");
for (const [label, key] of [["Decoding 키 그대로", k], ["인코딩해서", encodeURIComponent(k)]]) {
  for (const host of ["http://apis.data.go.kr", "https://apis.data.go.kr"]) {
    const u = `${host}/1360000/AsosDalyInfoService/getWthrDataList?serviceKey=${key}&numOfRows=1&pageNo=1&dataType=JSON&dataCd=ASOS&dateCd=DAY&startDt=${d}&endDt=${d}&stnIds=108`;
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(10000) });
      const t = (await r.text()).split(k).join("[KEY]").replace(/\s+/g, " ").slice(0, 300);
      console.log(`[${label} / ${host}] ${r.status} ${r.headers.get("content-type")}\n  ${t}`);
    } catch (e) { console.log(`[${label} / ${host}] 오류 ${e.message}`); }
  }
}
