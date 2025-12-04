import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("image");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "이미지 파일이 전달되지 않았습니다." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Image = buffer.toString("base64");

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "이 작물 사진의 병해 상태를 진단하고 원인과 해결 방법을 알려주세요.",
            },
            {
              type: "input_image",
              image_url: `data:image/jpeg;base64,${base64Image}`,
              detail: "auto"   // ✅ 이 줄이 핵심
            },
          ],
        },
      ],
    });

    const result =
      response.output_text ??
      response.output?.[0]?.content?.[0]?.text ??
      "결과를 생성하지 못했습니다.";

    return NextResponse.json({ result });

  } catch (error) {
    console.error("AI 분석 오류:", error);
    return NextResponse.json(
      {
        error: "AI 진단 중 오류 발생",
        detail: String(error),
      },
      { status: 500 }
    );
  }
}