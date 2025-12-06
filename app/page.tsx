import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {

    // ✅ multipart 정상 파싱
    const form = await req.formData();
    const file = form.get("file") as File | null;

    if (!file) {
      return NextResponse.json({
        ok:false,
        error:"이미지 파일 전달 실패"
      });
    }

    // ✅ 이미지 -> base64 변환
    const buf = Buffer.from(await file.arrayBuffer());
    const base64 = buf.toString("base64");

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // ✅ Vision 호출
    const response = await openai.responses.create({
      model:"gpt-4.1-mini",
      input:[
        {
          role:"user",
          content:[
            { type:"input_text", text:"이 농작물 상태를 분석해서 병명, 원인, 방제법을 알려줘." },
            {
              type:"input_image",
              image_base64: base64
            }
          ]
        }
      ],
      max_output_tokens:500
    });

    // ✅ 정상 리턴
    return NextResponse.json(response);

  } catch (err) {
    console.error("ANALYZE API ERROR:", err);

    return NextResponse.json({
      ok:false,
      error:"서버 처리 중 오류 발생"
    });
  }
}
