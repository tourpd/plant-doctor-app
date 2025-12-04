import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Vercel Edge 아닌 Node Runtime 사용 (파일 처리 안정)
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // ✅ multipart/form-data 파싱
    const formData = await req.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "이미지 파일이 없습니다." },
        { status: 400 }
      );
    }

    // ✅ 이미지 → Base64 변환
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");

    const mimeType = file.type || "image/jpeg";
    const base64Image = `data:${mimeType};base64,${base64}`;

    // ✅ OpenAI Vision 요청 (최신 SDK 규격 정상 포맷)
    const aiResponse = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "작물 병해 증상을 분석하고 원인과 대응 방법을 한국어로 알려주세요."
            },
            {
              type: "input_image",
              image_url: base64Image
            }
          ]
        }
      ]
    });

    // ✅ 결과 텍스트 추출
    const outputText =
      aiResponse.output_text ||
      aiResponse.output?.[0]?.content?.[0]?.text ||
      "AI 분석 결과를 가져오지 못했습니다.";

    return NextResponse.json({
      success: true,
      result: outputText,
    });
  } catch (error: any) {
    console.error("AI 분석 오류:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "서버 내부 오류 발생",
      },
      { status: 500 }
    );
  }
}