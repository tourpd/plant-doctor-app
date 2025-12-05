import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/* ===== ENV CHECK ===== */
console.log("===== ENV CHECK START =====");
console.log("OPENAI_API_KEY =", process.env.OPENAI_API_KEY);
console.log("===== ENV CHECK END =====");
/* ===================== */

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {

  try {

    const formData = await req.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "이미지가 전달되지 않았습니다." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");

    const result = await client.chat.completions.create({

      model: "gpt-4o-mini",

      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `
사진 속 작물의 병해를 판단하세요.
반드시 아래 JSON 형식으로만 응답하십시오.

{
  "diseaseName": "",
  "riskLevel": "저|중|고",
  "solution": [],
  "recommend": []
}
              `,
            },

            {
              type: "image_url",
              image_url: {
                url: \`data:image/jpeg;base64,\${base64}\`
              }
            }
          ]
        }
      ],

      max_tokens: 800,
    });

    const text = result.choices[0].message.content;

    if (!text) throw new Error("AI 응답 없음");

    return NextResponse.json(JSON.parse(text));

  } catch (err) {

    console.error("AI Diagnose Error:", err);

    return NextResponse.json(
      { error: "AI 분석 실패" },
      { status: 500 }
    );

  }

}
