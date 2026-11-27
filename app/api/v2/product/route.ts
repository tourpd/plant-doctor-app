// app/api/v2/product/route.ts
// 제품 이름(상표명)으로 공식 등록 사용법을 찾는다. AI를 쓰지 않아 비용이 들지 않는다.
import { NextResponse } from "next/server";
import { OFFICIAL_SOURCE } from "../../../v2/lib/official";
import { findOfficial } from "../../../v2/lib/officialFetch";

export const runtime = "nodejs";
export const maxDuration = 20;

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") ?? "").slice(0, 40);
  const crop = (sp.get("crop") ?? "").replace(/[\r\n]/g, " ").trim().slice(0, 30);
  const r = await findOfficial(q, crop);
  if (!r.ok) {
    const error =
      r.code === "no-key"
        ? "이 주소에는 공식 자료 열쇠가 등록돼 있지 않습니다."
        : r.code === "bad-name"
          ? "제품 이름을 두 글자 이상 넣어 주세요."
          : "공식 자료 서버가 응답하지 않습니다. 잠시 뒤 다시 해 주세요.";
    return NextResponse.json(
      { ok: false, code: r.code, detail: r.detail, error },
      { status: r.code === "bad-name" ? 400 : 502 }
    );
  }
  // 한 번에 너무 많이 보내지 않는다 (두 글자 검색은 수십 개가 나올 수 있다)
  return NextResponse.json({
    ok: true,
    source: OFFICIAL_SOURCE,
    total: r.products.length,
    products: r.products.slice(0, 30),
  });
}
