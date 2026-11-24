// 기상청 단기예보(공공데이터포털 동네예보) — 포토닥터가 이미 쓰는 DATA_GO_KR_KEY 로 부른다.
import type { WeatherDay } from "./logic";

/** 위도·경도 → 기상청 격자(nx, ny). 기상청 공개 변환식(Lambert 정각원추도법) */
export function toGrid(lat: number, lon: number): { nx: number; ny: number } {
  const RE = 6371.00877, GRID = 5.0, SLAT1 = 30.0, SLAT2 = 60.0, OLON = 126.0, OLAT = 38.0, XO = 43, YO = 136;
  const DEGRAD = Math.PI / 180.0;
  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD, slat2 = SLAT2 * DEGRAD, olon = OLON * DEGRAD, olat = OLAT * DEGRAD;
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);
  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);
  let theta = lon * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;
  return {
    nx: Math.floor(ra * Math.sin(theta) + XO + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5),
  };
}

/** 지금 받을 수 있는 가장 최근 발표 시각 (하루 8번: 02·05·08·11·14·17·20·23시, 발표 15분 뒤부터) */
export function baseDateTime(now: Date): { base_date: string; base_time: string } {
  const kst = new Date(now.getTime() + 9 * 3600e3);
  const mins = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  const hours = [23, 20, 17, 14, 11, 8, 5, 2];
  const hit = hours.find((h) => mins >= h * 60 + 15);
  const day = hit === undefined ? new Date(kst.getTime() - 86400e3) : kst;
  const h = hit === undefined ? 23 : hit;
  return {
    base_date: day.toISOString().slice(0, 10).replace(/-/g, ""),
    base_time: `${String(h).padStart(2, "0")}00`,
  };
}

/** "강수없음" / "1mm 미만" / "3.0mm" / "30.0~50.0mm" / "50.0mm 이상" → mm */
export function parseRain(v: string): number {
  if (!v || v.includes("없음")) return 0;
  if (v.includes("미만")) return 0.5;
  const m = v.match(/[\d.]+/);
  return m ? Number(m[0]) : 0;
}

type KmaItem = { category: string; fcstDate: string; fcstTime: string; fcstValue: string };

/** 시간별 예보 항목을 날짜별 요약으로 묶는다 */
export function summarize(items: KmaItem[], todayYmd: string): WeatherDay[] {
  const byDay = new Map<string, KmaItem[]>();
  for (const it of items) {
    if (it.fcstDate < todayYmd) continue;
    const arr = byDay.get(it.fcstDate) ?? [];
    arr.push(it);
    byDay.set(it.fcstDate, arr);
  }
  const nums = (arr: KmaItem[], cat: string) =>
    arr.filter((x) => x.category === cat).map((x) => Number(x.fcstValue)).filter((n) => !isNaN(n));
  return Array.from(byDay.keys())
    .sort()
    .slice(0, 3)
    .map((d) => {
      const arr = byDay.get(d) ?? [];
      const tmp = nums(arr, "TMP");
      const tmx = nums(arr, "TMX");
      const tmn = nums(arr, "TMN");
      const pop = nums(arr, "POP");
      const wsd = nums(arr, "WSD");
      const rain = arr.filter((x) => x.category === "PCP").reduce((s, x) => s + parseRain(x.fcstValue), 0);
      return {
        date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
        rainMm: Math.round(rain * 10) / 10,
        rainProb: pop.length ? Math.max(...pop) : 0,
        windMs: wsd.length ? Math.max(...wsd) : 0,
        tMax: tmx.length ? Math.max(...tmx) : tmp.length ? Math.max(...tmp) : 0,
        tMin: tmn.length ? Math.min(...tmn) : tmp.length ? Math.min(...tmp) : 0,
      };
    });
}

/** 기상청 단기예보를 받아 3일 요약으로. 키가 없거나 실패하면 null */
export async function getKmaForecast(lat: number, lon: number, now = new Date()): Promise<WeatherDay[] | null> {
  const key = process.env.DATA_GO_KR_KEY;
  if (!key) return null;
  const { nx, ny } = toGrid(lat, lon);
  const { base_date, base_time } = baseDateTime(now);
  const u =
    `http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?serviceKey=${encodeURIComponent(key)}` +
    `&numOfRows=1000&pageNo=1&dataType=JSON&base_date=${base_date}&base_time=${base_time}&nx=${nx}&ny=${ny}`;
  try {
    const r = await fetch(u, { signal: AbortSignal.timeout(8000), next: { revalidate: 3600 } });
    const j = await r.json();
    const items: KmaItem[] = [].concat(j?.response?.body?.items?.item || []);
    if (!items.length) {
      console.error("KMA 예보 응답에 자료 없음:", JSON.stringify(j?.response?.header ?? j).slice(0, 200));
      return null;
    }
    const today = new Date(now.getTime() + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, "");
    const days = summarize(items, today);
    return days.length ? days : null;
  } catch (e) {
    console.error("KMA 예보 호출 실패:", e);
    return null;
  }
}
