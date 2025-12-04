import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("image") as File;

    if (!file) {
      return NextResponse.json(
        { error: "이미지가 업로드되지 않았습니다." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const result = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "이 사진을 보고 작물 병해를 진단하고 원인과 대처법을 한국어로 간단히 알려줘.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${file.type};base64,${buffer.toString("base64")}`,
              },
            },
          ],
        },
      ],
    });

    const response =
      result.choices[0]?.message?.content || "AI 분석 결과 없음";

    return NextResponse.json({
      success: true,
      diagnosis: response,
    });
  } catch (error) {
    console.error("AI 진단 에러:", error);

    return NextResponse.json(
      { error: "AI 처리 중 서버 오류 발생" },
      { status: 500 }
    );
  }
}
