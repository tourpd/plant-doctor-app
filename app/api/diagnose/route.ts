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
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: `
너는 한국 농민 옆에서 함께 작물을 보고 설명해주는 농업 전문가다.

[규칙]
- 병명은 단정하지 말고 가능성으로 설명한다
- 전문용어는 최대한 풀어서 설명한다
- 농민 말투로 말한다
- "지금 이렇게 해보세요" 중심으로 안내한다
- 이 안내는 참고용이며 최종 판단은 농민 책임임을 명확히 한다

출력은 자연어 문단으로만 작성한다.
          `,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "이 사진을 보고 농민에게 현재 상황과 조치 방법을 설명해줘",
            },
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
      text: completion.choices[0].message.content,
      disclaimer:
        "이 안내는 참고용이며, 최종 판단과 조치는 농민 본인의 책임입니다.",
    });
  } catch (e) {
    console.error("AI 진단 실패:", e);
    return NextResponse.json(
      { ok: false, error: "AI 진단 실패" },
      { status: 500 }
    );
  }
}