// 기상청 ASOS 일자료 (공공데이터포털) — 진단 전 7일 날씨 요약
import { stationFor } from "./stations";

export type WeatherSummary = {
  station: string; exact: boolean; from: string; to: string;
  maxTaAvg: number | null; maxTaMax: number | null; minTaMin: number | null;
  rainSum: number; rainDays: number; lastRainDaysAgo: number | null; sunHours: number | null; humAvg: number | null;
  text: string;
};
const ymd = (d: Date) => new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, "");

export async function getWeather(region: string, at: Date): Promise<WeatherSummary | null> {
  const key = process.env.DATA_GO_KR_KEY;
  const st = stationFor(region);
  if (!key || !st) return null;
  const end = new Date(at.getTime() - 86400e3), start = new Date(at.getTime() - 7 * 86400e3);
  const u = `http://apis.data.go.kr/1360000/AsosDalyInfoService/getWthrDataList?serviceKey=${encodeURIComponent(key)}&numOfRows=10&pageNo=1&dataType=JSON&dataCd=ASOS&dateCd=DAY&startDt=${ymd(start)}&endDt=${ymd(end)}&stnIds=${st.id}`;
  try {
    const r = await fetch(u, { signal: AbortSignal.timeout(5000) });
    const j: any = await r.json();
    const items: any[] = [].concat(j?.response?.body?.items?.item || []);
    if (!items.length) return null;
    const num = (v: any) => (v === "" || v == null || isNaN(Number(v)) ? null : Number(v));
    const maxT = items.map((x) => num(x.maxTa)).filter((x): x is number => x != null);
    const minT = items.map((x) => num(x.minTa)).filter((x): x is number => x != null);
    const rain = items.map((x) => num(x.sumRn) || 0);
    const sun = items.map((x) => num(x.sumSsHr)).filter((x): x is number => x != null);
    const hum = items.map((x) => num(x.avgRhm)).filter((x): x is number => x != null);
    let lastRain: number | null = null;
    for (let i = rain.length - 1; i >= 0; i--) if (rain[i] >= 1) { lastRain = rain.length - i; break; }
    const avg = (a: number[]) => (a.length ? Math.round((a.reduce((s, x) => s + x, 0) / a.length) * 10) / 10 : null);
    const s: WeatherSummary = {
      station: `${items[0].stnNm || st.name}(${st.exact ? "해당 지역" : "가까운 관측소"})`, exact: st.exact,
      from: String(items[0].tm), to: String(items[items.length - 1].tm),
      maxTaAvg: avg(maxT), maxTaMax: maxT.length ? Math.max(...maxT) : null, minTaMin: minT.length ? Math.min(...minT) : null,
      rainSum: Math.round(rain.reduce((a, b) => a + b, 0) * 10) / 10, rainDays: rain.filter((x) => x >= 1).length,
      lastRainDaysAgo: lastRain, sunHours: sun.length ? Math.round(sun.reduce((a, b) => a + b, 0)) : null, humAvg: avg(hum), text: "",
    };
    s.text = `관측소 ${s.station}, ${s.from}~${s.to}: 낮 최고기온 평균 ${s.maxTaAvg}℃(최고 ${s.maxTaMax}℃), 밤 최저 ${s.minTaMin}℃, ` +
      `강수 합계 ${s.rainSum}mm(1mm 이상 온 날 ${s.rainDays}일${s.lastRainDaysAgo ? `, 마지막 비 ${s.lastRainDaysAgo}일 전` : ", 7일간 비 없음"}), ` +
      `일조 합계 ${s.sunHours ?? "?"}시간, 평균 습도 ${s.humAvg ?? "?"}%`;
    return s;
  } catch {
    return null;
  }
}
