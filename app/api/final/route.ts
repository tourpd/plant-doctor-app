// app/api/final/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    /**
     * ✅ 질문 답변이 없으면 FINAL 주지 않는다
     */
    if (!body?.answers) {
      return NextResponse.json({
        ok: true,
        phase: "QUESTION",
        message: "추가 질문이 필요합니다.",
      });
    }

    /**
     * ✅ 질문이 끝났을 때만 FINAL 반환
     */
    return NextResponse.json({
      ok: true,
      phase: "FINAL",

      final_judgement:
        "현재 상태는 병해 가능성이 높은 단계로 판단됩니다.",

      actions: {
        doNow: [
          "문제가 의심되는 개체를 즉시 분리하십시오.",
          "통풍을 확보해 습한 환경을 제거하십시오.",
        ],
        doNot: [
          "원인 확인 없이 약제를 먼저 사용하지 마십시오.",
          "같은 계열의 약제를 반복 사용하지 마십시오.",
        ],
      },

      links: {
        kaftv: "https://www.youtube.com/@한국농수산TV",
        emergency119: "https://docs.google.com/forms/d/e/1FAIpQLSdKgcwl_B-10yU0gi4oareM4iajMPND6JtGIZEwjbwPbnQBEg/viewform",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "FINAL_API_ERROR" },
      { status: 500 }
    );
  }
}