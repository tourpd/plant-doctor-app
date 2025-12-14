// app/api/analyze-insect/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

/**
 * 📍 현재 파일: app/api/analyze-insect/route.ts
 */

// SYSTEM PROMPTS
import { SYSTEM_PROMPT_VFINAL } from "../../prompts/system_prompt_vfinal";
import { GUARD_PROMPT_DIAGNOSIS } from "../../prompts/guard_prompt_diagnosis";

// INSECT CONTROL DATA
import { CONTROL_SETS_INSECT } from "../../data/controlSets_insect";
import { INSECT_TO_SET } from "../../data/insectToSet";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const image = form.get("image") as File;
    const cropName = (form.get("cropName") as string)?.trim();

    if (!image || !cropName) {
      return NextResponse.json(
        { ok: false, error: "이미지와 작물명이 필요합니다." },
        { status: 400 }
      );
    }

    // 이미지 → base64
    const buffer = Buffer.from(await image.arrayBuffer());
    const base64 = buffer.toString("base64");
    const imageUrl = `data:image/jpeg;base64,${base64}`;

    // SYSTEM PROMPT
    const SYSTEM_PROMPT = `
${SYSTEM_PROMPT_VFINAL}

${GUARD_PROMPT_DIAGNOSIS}

[출력 형식 – 해충 진단]

- 사진 정보가 부족하면 해충을 확정하지 말 것
- 이 경우 농약·방제 제시 절대 금지
- 반드시 추가 촬영 요구를 명확히 지시할 것
`;

    // ✅ USER PROMPT (핵심 수정)
    const USER_PROMPT = `
작물명: ${cropName}

이 사진은 해충 진단의 참고 자료일 뿐이다.

⚠️ 가장 중요한 원칙:
사진 1장으로 해충이 명확히 보이지 않으면
❌ 해충명을 확정하지 말고
❌ 농약이나 방제 방법을 제시하지 말 것

이 경우 반드시 다음 문장을 포함하라:
“사진만으로 해충을 확정하기 어렵습니다. 추가 촬영이 필요합니다.”

추가로 요청해야 할 사진:
- 잎 앞면 / 잎 뒷면 근접 사진
- 신초·꽃·과실 확대 사진
- 피해 부위 전체가 보이는 사진

해충 개체가 **명확히 확인되는 경우에만**
아래를 허용한다:
- 1순위 해충 + 대안 2개 (확률 합계 100% 이하)
- 서식 위치와 피해 양상 명시

마지막에는 반드시 안내:
- AI 진단 재요청
- 농사 119 출동 요청
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.15,
      max_tokens: 900,
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

    const rawResult = response.choices[0]?.message?.content;
    if (!rawResult) {
      return NextResponse.json(
        { ok: false, error: "AI 결과 생성 실패" },
        { status: 500 }
      );
    }

    let finalResult = rawResult;

    // 🔒 핵심 가드: 확정 불가 문구가 있으면 방제 로직 차단
    if (
      rawResult.includes("확정하기 어렵") ||
      rawResult.includes("추가 촬영") ||
      rawResult.includes("사진만으로")
    ) {
      return NextResponse.json({ ok: true, result: finalResult });
    }

    // =========================
    // 방제 재구성 (확정일 때만)
    // =========================
    try {
      const match = rawResult.match(/1순위[^:]*[:\-]?\s*([^\s(]+)/);
      if (!match) {
        return NextResponse.json({ ok: true, result: finalResult });
      }

      const insectName = match[1].trim();
      const setKey = INSECT_TO_SET[insectName];
      if (!setKey || !CONTROL_SETS_INSECT[setKey]) {
        return NextResponse.json({ ok: true, result: finalResult });
      }

      const set = CONTROL_SETS_INSECT[setKey];

      finalResult = finalResult.replace(
        /\[방제·관리 방향][\s\S]*?(?=\n\[|$)/,
        ""
      );

      const conventionalBlock = set.treatmentPlan
        .map(
          (p, i) =>
            `${i + 1}. ${p.step}\n   - ${p.pesticide} / ${p.company}\n   → ${p.purpose}`
        )
        .join("\n");

      const ecoBlock = set.ecoPlan
        .map(e => `- ${e.material}: ${e.purpose}`)
        .join("\n");

      finalResult += `
[방제·관리 방향]

[관행농 (PLS 기준 등록 약제)]
${conventionalBlock}

[친환경·유기농 농사]
${ecoBlock}
`;
    } catch (e) {
      console.error("해충 방제 재구성 오류:", e);
    }

    return NextResponse.json({ ok: true, result: finalResult });
  } catch (err) {
    console.error("AI 해충 분석 오류:", err);
    return NextResponse.json(
      { ok: false, error: "AI 해충 분석 중 오류 발생" },
      { status: 500 }
    );
  }
}