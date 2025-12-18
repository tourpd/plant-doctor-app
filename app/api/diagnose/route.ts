import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const image = formData.get("image") as File | null;

    if (!image) {
      return NextResponse.json(
        { ok: false, error: "사진이 없습니다." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    const base64 = buffer.toString("base64");

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `
너는 사진을 보고 내부적으로만 판단하는 분석 AI다.

[규칙]
- 농민에게 보여줄 문장 생성 금지
- 병명 단정 금지
- 결과는 화면 출력용이 아니다
- 관찰 포인트와 불확실성만 내부 메모로 정리한다
          `,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "이 사진을 내부 분석용으로만 관찰해라" },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64}`,
              },
            },
          ],
        },
      ],
    });

    return NextResponse.json({
      ok: true,
      step: "STEP1",
      analysis_notes: completion.choices[0].message.content,
    });
  } catch (e) {
    console.error("STEP1 분석 실패:", e);
    return NextResponse.json(
      { ok: false, error: "STEP1 분석 실패" },
      { status: 500 }
    );
  }
}