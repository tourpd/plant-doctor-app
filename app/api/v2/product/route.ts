// app/api/v2/product/route.ts
// 제품 이름으로 공식 사용법 찾기 (AI 비용 0원)
//   ?q=싹쓰       → 이름 후보 목록 (두세 글자 자동완성)
//   ?name=...&crop=고추 → 라벨 화면 모양의 사용법 (없으면 label: null)
//   ?check=1      → 인증키 연결·자료 형식 확인 (승인 직후 한 번 열어 본다)
import { NextResponse } from "next/server";
import { catalogConfigured, checkCatalog, findProduct, searchNames, toLabel } from "../../../v2/lib/catalog";

export const runtime = "nodejs";
export const maxDuration = 60;

const clean = (v: string | null) => (v ?? "").replace(/[\r\n]/g, " ").trim().slice(0, 40);

export async function GET(req: Request) {
  const u = new URL(req.url);
  try {
    if (u.searchParams.get("check")) {
      return NextResponse.json({ ok: true, ...(await checkCatalog()) });
    }
    if (!catalogConfigured()) {
      return NextResponse.json({ ok: true, configured: false, names: [], label: null });
    }
    const q = clean(u.searchParams.get("q"));
    if (q) {
      return NextResponse.json({ ok: true, configured: true, names: await searchNames(q) });
    }
    const name = clean(u.searchParams.get("name"));
    const crop = clean(u.searchParams.get("crop"));
    if (!name) return NextResponse.json({ ok: false, error: "제품 이름이 없습니다." }, { status: 400 });
    const it = await findProduct(name);
    return NextResponse.json({ ok: true, configured: true, label: it ? toLabel(it, crop) : null });
  } catch (e) {
    console.error("❌ PRODUCT API ERROR:", e);
    return NextResponse.json(
      { ok: false, code: "catalog", error: "공식 자료를 불러오지 못했습니다. 잠시 뒤 다시 해 주세요." },
      { status: 502 }
    );
  }
}
