import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    // ✅ 프론트 키와 100% 매칭
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({
        ok: false,
        error: "이미지 파일이 전달되지 않았습니다."
      });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    const res = await client.responses.create({
      model: "gpt-4o-mini",
      input: [{
        role: "user",
        content: [
          {
            type: "input_text",
            text: `
너는 대한민국 농작물 병해 진단 전문가다.
이 작물 사진을 분석해서:

1) 작물명
2) 피해 원인
3) 병해충 혹은 생리장해 진단
4) 구체적인 대응 방법

농민이 바로 이해할 수 있게 정리해줘.
`
          },
          {
            type: "input_image",
            image_base64: base64
          }
        ]
      }],
      max_output_tokens: 700
    });

    return NextResponse.json({
      ok: true,
      message: res.output_text
    });

  } catch (err: any) {
    console.error("AI ERROR:", err);

    return NextResponse.json({
      ok: false,
      error: err.message || "AI 서버 오류"
    });
  }
}
