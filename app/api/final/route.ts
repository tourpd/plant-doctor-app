// app/api/final/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";

/* ======================
   lib (루트)
====================== */
import { extractSignalsFromStep1 } from "../../../lib/extractSignalsFromStep1";
import { extractSignalsFromAnswers } from "../../../lib/extractSignalsFromAnswers";
import { calcSignalScoreAndTop3 } from "../../../lib/calcSignalScore";
import { mixProductsSafely } from "../../../lib/safeProductMixer";
import { generateProductReason } from "../../../lib/productReasonGenerator";
import { createIncident } from "../../../lib/createIncident";

/* ======================
   data
====================== */
import { PRODUCT_META } from "../../../app/data/productMeta";

/* ======================
   고정 멘트 (절대 변경 금지)
====================== */
const FIXED_FOLLOWUP_MESSAGE = `
병해는 하루아침에 끝나지 않습니다.

방제 후 3~4일,
때로는 1주일 뒤의 모습이
진짜 판단의 기준이 됩니다.

언제든 다시 사진을 올려주세요.
한국농수산TV 포토닥터는
언제나 농민 곁에 있습니다.
`.trim();

/* ======================
   POST
====================== */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      history,
      crop,
      region,
      primary_category,
    } = body || {};

    if (!Array.isArray(history) || history.length === 0) {
      return NextResponse.json(
        { ok: false, error: "history가 없습니다." },
        { status: 400 }
      );
    }

    /* ======================
       1️⃣ 신호 추출
    ====================== */
    const step1Signals = extractSignalsFromStep1(history as any);
    const freeTextSignals = extractSignalsFromAnswers(history as any);

    const mergedSignals = Array.from(
      new Set([...step1Signals, ...freeTextSignals])
    );

    /* ======================
       2️⃣ Top3 계산
    ====================== */
    const { signalScore, possible_causes } =
      calcSignalScoreAndTop3(mergedSignals);

    /* ======================
       3️⃣ 활성 신호 타입
    ====================== */
    const activeSignals = Array.from(
      new Set(
        mergedSignals.map((s: any) =>
          typeof s === "string" ? s : s.type
        )
      )
    );

    /* ======================
       4️⃣ 제품 믹스
    ====================== */
    const mixedProducts = mixProductsSafely(
      PRODUCT_META,
      activeSignals,
      {
        maxItems: 3,
        maxPaidRatio: 0.33,
      }
    );

    const eco_friendly_products =
      mixedProducts.length > 0
        ? {
            "현장 기준 자재": mixedProducts.map((p: any) => ({
              name: p.name,
              reason: generateProductReason(
                p.name,
                activeSignals,
                signalScore
              ),
            })),
          }
        : {};

    /* ======================
       5️⃣ 지금 피해야 할 행동
    ====================== */
    let do_not: string[] = [];

    if (primary_category === "PEST") {
      do_not = [
        "개체 수 확인 없이 약제를 반복 살포하지 마세요.",
        "같은 계열 약제를 짧은 간격으로 연속 사용하지 마세요.",
      ];
    }

    if (primary_category === "DISEASE") {
      do_not = [
        "병원균이 특정되지 않은 상태에서 살균제를 혼용하지 마세요.",
        "증상 원인 확인 없이 강한 약제를 먼저 사용하지 마세요.",
      ];
    }

    if (primary_category === "ENVIRONMENT") {
      do_not = [
        "비료를 즉시 추가 투입하지 마세요.",
        "관수량을 급격히 늘리거나 줄이지 마세요.",
      ];
    }

    /* ======================
       6️⃣ 119 조건
    ====================== */
    const need_119 =
      signalScore >= 70 ||
      (Array.isArray(possible_causes) &&
        possible_causes.some((c: any) => c?.probability >= 85));

    /* ======================
       7️⃣ incident 생성
    ====================== */
    let incident_id: string | null = null;

    try {
      const created = await (createIncident as any)({
        crop,
        region,
        primary_category,
        possible_causes,
        need_119,
        created_at: Date.now(),
      });

      incident_id =
        (created && (created.id || created.incident_id)) ?? null;
    } catch {
      incident_id = null;
    }

    /* ======================
       FINAL 반환
    ====================== */
    return NextResponse.json({
      ok: true,
      phase: "FINAL",

      crop,
      region,
      primary_category,

      possible_causes,
      eco_friendly_products,
      do_not,

      followup_message: FIXED_FOLLOWUP_MESSAGE,

      need_119,
      incident_id,
    });
  } catch (err) {
    console.error("[FINAL ROUTE ERROR]", err);
    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500 }
    );
  }
}
