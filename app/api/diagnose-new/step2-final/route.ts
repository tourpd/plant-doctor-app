import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const { observations, answers, inferred_crop = "작물 미상" } = await req.json();
    if (!observations || !answers) {
      return NextResponse.json({ ok: false, error: "입력 부족" }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `
반드시 JSON만 출력한다.

{
  "disease_probabilities": [
    { "name": "○○병", "probability": 80 },
    { "name": "△△병", "probability": 20 }
  ],
  "summary": "판단 요약",
  "immediate_actions": ["지금 당장 할 수 있는 행동"]
}
`
        },
        {
          role: "user",
          content: `
작물: ${inferred_crop}

[관찰]
${observations.join("\n")}

[답변]
${answers.join("\n")}
`
        }
      ]
    });

    const parsed = JSON.parse(completion.choices[0].message.content || "{}");

    return NextResponse.json({
      ok: true,
      step: "STEP2",
      result: parsed,
      products: {
        insect: shuffle(["싹쓰리충", "싹쓰리충골드", "친환경 해충제"]),
        fungal: shuffle(["멸규니", "유기농 살균제", "미생물 제제"]),
      },
      disclaimer:
        "본 정보는 참고용이며, 자재 사용 및 최종 판단 책임은 농민 본인에게 있습니다.",
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "STEP2 실패" }, { status: 500 });
  }
}

function shuffle<T>(arr: T[]) {
  return [...arr].sort(() => Math.random() - 0.5);
}