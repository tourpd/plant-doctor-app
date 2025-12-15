import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/**
 * STEP 1 전용 API
 * - 이미지 관찰만 수행
 * - 확정 판단 금지
 * - 다음 단계(STEP2/STEP3)만 결정
 */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const image = form.get("image") as File | null;
    const cropName = (form.get("cropName") as string | null)?.trim();

    if (!image || !cropName) {
      return NextResponse.json(
        { ok: false, error: "image와 cropName이 필요합니다." },
        { status: 400 }
      );
    }

    /* =========================
       1️⃣ 이미지 → base64
    ========================= */
    const buffer = Buffer.from(await image.arrayBuffer());
    const base64 = buffer.toString("base64");
    const imageUrl = `data:image/jpeg;base64,${base64}`;

    /* =========================
       2️⃣ STEP 1 전용 SYSTEM PROMPT
    ========================= */
    const SYSTEM_PROMPT = `
너는 농업 AI의 STEP 1 관찰자다.

[역할]
- 사진에서 보이는 현상만 관찰한다
- 병명, 병 이름, 약제, 처방을 절대 말하지 않는다
- 판단이 가능한지 / 불가능한지만 결정한다

[절대 금지]
- 병명 단정
- 농약·방제·치료 언급
- 공포 조성 문장

[출력 목적]
- 사진 관찰 요약
- 위험도 판단
- 사진만으로 확정 가능한지 여부
- 다음 단계 결정
`;

    /* =========================
       3️⃣ USER PROMPT
    ========================= */
    const USER_PROMPT = `
작물: ${cropName}

이 사진을 보고 다음을 판단하라.

1. 눈에 보이는 증상만 간단히 정리
2. 위험도 (LOW / MID / HIGH)
3. 사진만으로 원인 확정이 가능한지 여부
4. 원인 범주를 "병해 / 환경 스트레스 / 생리장해" 중에서
   확률로 나누어 제시
5. 다음 단계가 질문(STEP2)이 필요한지 결정

반드시 지켜라:
- 병 이름 금지
- 추측 단정 금지
- 관찰자 시점 유지
`;

    /* =========================
       4️⃣ OpenAI 호출
    ========================= */
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 800,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: USER_PROMPT },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
    });

    const aiText = response.choices[0]?.message?.content ?? "";

    /* =========================
       5️⃣ STEP 1 JSON 강제 조립
       (AI 출력이 흔들려도 구조는 고정)
    ========================= */

    // 🔒 기본값 (안전)
    let riskLevel: "LOW" | "MID" | "HIGH" = "MID";
    let canConfirmByImage = false;

    if (aiText.includes("위험") && aiText.includes("높")) {
      riskLevel = "HIGH";
    } else if (aiText.includes("낮")) {
      riskLevel = "LOW";
    }

    // 시들음 / 전염 / 내부 이상 암시 → 사진 확정 불가
    if (
      aiText.includes("시들") ||
      aiText.includes("번질") ||
      aiText.includes("내부")
    ) {
      canConfirmByImage = false;
    }

    const step1 = {
      step: 1,
      mode: "IMAGE_OBSERVATION",

      crop: cropName,

      observation: {
        visible_symptoms: aiText
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .slice(0, 3),
        symptom_pattern: "unknown",
        confidence_in_visual: canConfirmByImage ? 0.7 : 0.4,
      },

      initial_assessment: {
        risk_level: riskLevel,
        can_confirm_by_image: canConfirmByImage,
        reason: canConfirmByImage
          ? "사진에서 원인이 비교적 명확함"
          : "사진만으로는 원인 확정이 어려움",
      },

      suspected_categories: [
        { category: "병해", confidence: 0.5 },
        { category: "환경 스트레스", confidence: 0.3 },
        { category: "생리장해", confidence: 0.2 },
      ],

      decision: {
        next_step: canConfirmByImage
          ? "FINAL_DECISION"
          : "FOLLOW_UP_QUESTION",
        need_farmer_input: !canConfirmByImage,
        explanation: canConfirmByImage
          ? "사진만으로 판단 가능"
          : "현장 정보가 추가로 필요함",
      },

      ui_hint: {
        message: canConfirmByImage
          ? "사진을 기준으로 판단을 이어가겠습니다."
          : "사진만으로는 부족해 몇 가지만 더 여쭤보겠습니다.",
        tone: "calm_professional",
      },

      system_notes: {
        do_not: ["병명 단정", "농약·약제·처방 언급"],
        allowed: ["관찰 설명", "불확실성 명시", "다음 단계 안내"],
      },
    };

    /* =========================
       6️⃣ 응답
    ========================= */
    return NextResponse.json({
      ok: true,
      step1,
    });
  } catch (err) {
    console.error("STEP1 분석 오류:", err);
    return NextResponse.json(
      { ok: false, error: "STEP1 이미지 분석 실패" },
      { status: 500 }
    );
  }
}