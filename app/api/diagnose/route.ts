import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const image = form.get("image") as File | null;

    if (!image) {
      return NextResponse.json({ ok: false, error: "사진이 없습니다" });
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    const base64 = buffer.toString("base64");

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: `
너는 농민 옆에서 함께 작물을 보는 사람이다.

규칙:
- 병명 단정 금지
- 전문용어 최소화
- 농민 말투
- "지금 이렇게 해보세요" 중심
- 책임은 농민에게 있음을 명확히

출력은 자연어 문단으로만.
`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "이 사진을 보고 농민에게 설명해줘" },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${base64}` },
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
    return NextResponse.json({ ok: false, error: "AI 진단 실패" });
  }
}