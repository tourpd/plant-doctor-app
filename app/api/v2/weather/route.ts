// app/api/v2/weather/route.ts
// 밭 위치의 3일 예보를 가져온다.
// 1순위: 기상청 단기예보(포토닥터가 이미 쓰는 DATA_GO_KR_KEY). 실패하면 Open-Meteo 로 대신한다.
import { NextResponse } from "next/server";
import { getKmaForecast } from "../../../v2/lib/kma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  // 우리나라 범위 밖 좌표는 받지 않는다
  if (!(lat >= 32 && lat <= 39.5 && lon >= 124 && lon <= 132)) {
    return NextResponse.json({ ok: false, error: "위치가 올바르지 않습니다." }, { status: 400 });
  }
  const kma = await getKmaForecast(lat, lon);
  if (kma) return NextResponse.json({ ok: true, source: "기상청 단기예보", days: kma });

  const q = new URLSearchParams({
    latitude: lat.toFixed(2),
    longitude: lon.toFixed(2),
    daily:
      "precipitation_sum,precipitation_probability_max,wind_speed_10m_max,temperature_2m_max,temperature_2m_min",
    wind_speed_unit: "ms",
    timezone: "Asia/Seoul",
    forecast_days: "3",
  });
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${q.toString()}`, {
      next: { revalidate: 3600 }, // 같은 지역은 1시간 동안 다시 묻지 않는다
    });
    if (!res.ok) throw new Error(`weather ${res.status}`);
    const data = await res.json();
    const d = data?.daily;
    if (!d || !Array.isArray(d.time)) throw new Error("weather shape");
    const days = (d.time as string[]).map((date, i) => ({
      date,
      rainMm: Number(d.precipitation_sum?.[i] ?? 0),
      rainProb: Number(d.precipitation_probability_max?.[i] ?? 0),
      windMs: Number(d.wind_speed_10m_max?.[i] ?? 0),
      tMax: Number(d.temperature_2m_max?.[i] ?? 0),
      tMin: Number(d.temperature_2m_min?.[i] ?? 0),
    }));
    return NextResponse.json({ ok: true, source: "Open-Meteo(예비)", days });
  } catch (e) {
    console.error("❌ WEATHER API ERROR:", e);
    return NextResponse.json({ ok: false, error: "날씨를 가져오지 못했습니다." }, { status: 502 });
  }
}
