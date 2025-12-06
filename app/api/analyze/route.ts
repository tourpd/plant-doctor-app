import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;

    if (!file) {
      return NextResponse.json({
        ok: false,
        error: "이미지 파일이 전달되지 않았습니다.",
      });
    }

    // 파일 -> base64 변환
    const buffer = Buffer.from(await file.arrayBuffer());
    const imageBase64 = buffer.toString("base64");

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: "이 농작물 사진을 보고 병해충 진단을 해줘. 작물명, 병명, 원인, 대응법을 자세히 설명해줘." },
            {
              type: "input_image",
              image_base64: imageBase64,
            },
          ],
        },
      ],
      max_output_tokens: 700,
    });

    const result =
      response.output_text ||
      "AI 분석 결과를 생성하지 못했습니다.";

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (err: any) {
    console.error("AI error:", err);

    return NextResponse.json({
      ok: false,
      error: err.message || "AI 분석 실패",
    });
  }
}
