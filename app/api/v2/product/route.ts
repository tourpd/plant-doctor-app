// app/api/v2/product/route.ts
// 제품 이름(상표명)으로 공식 등록 사용법을 찾는다. AI를 쓰지 않아 비용이 들지 않는다.
import { NextResponse } from "next/server";
import { OFFICIAL_SOURCE } from "../../../v2/lib/official";
import { fetchRows, findForTarget, findOfficial } from "../../../v2/lib/officialFetch";

export const runtime = "nodejs";
export const maxDuration = 20;

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") ?? "").slice(0, 40);
  const crop = (sp.get("crop") ?? "").replace(/[\r\n]/g, " ").trim().slice(0, 30);
  // 점검용: 자료 원문 중 특정 글자가 든 줄만 본다 (열쇠는 내보내지 않는다)
  const grep = (sp.get("grep") ?? "").slice(0, 20);
  if (grep && process.env.MAFRA_API_KEY) {
    const rows = await fetchRows(q.replace(/\s+/g, "")).catch(() => []);
    const hit = rows.filter((x) => JSON.stringify(x).includes(grep)).slice(0, 6);
    return NextResponse.json({
      total: rows.length,
      hit: hit.map((x) =>
        [x.C_BRAND_NM, x.C_ITEM_NM, x.C_CROP_NM, x.C_APLCN_DSINST_NM, x.A_DLTN_MLTPL_REGVL, x.C_USGQTY_REGVL, x.C_USE_PPRTM_REGVL, x.C_USE_MTHD_REGVL, x.A_SAFE_USE_ERA_REGVL, x.A_SAFE_USE_NOFTM_REGVL].join(" | ")
      ),
    });
  }
  const target = (sp.get("target") ?? "").slice(0, 30);
  if (target) {
    const t = await findForTarget(crop, target);
    return NextResponse.json({
      ok: t.ok,
      code: t.ok ? null : t.code,
      target: t.ok ? t.target : null,
      total: t.products.length,
      products: t.products.slice(0, 30).map((p) => ({
        name: p.product_name,
        variant: p.variant,
        moa: p.moa_code,
        source: p.source_label ?? "공식",
        use: p.uses[p.my_use_index ?? 0] ?? null,
      })),
    });
  }
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
