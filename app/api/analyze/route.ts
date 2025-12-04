import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    if (
      !contentType.includes("multipart/form-data") &&
      !contentType.includes("application/x-www-form-urlencoded")
    ) {
      return NextResponse.json({
        ok: false,
        error: "이미지 업로드 형식이 잘못되었습니다."
      });
    }

    // ✅ 이미지 읽기
    const formData = await req.formData();
    const image = formData.get("image");

    if (!image || !(image instanceof File)) {
      return NextResponse.json({
        ok: false,
        error: "이미지 파일이 전달되지 않았습니다."
      });
    }

    // ✅ base64 변환
    const buffer = Buffer.from(await image.arrayBuffer());
    const base64 = buffer.toString("base64");

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        ok: false,
        error: "OPENAI_API_KEY가 설정되어 있지 않습니다."
      });
    }

    // ✅ OpenAI Vision 분석 호출
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content:
              "당신은 농작물 병해 진단 전문가입니다. 사진을 보고 병명을 추정하고 방제법을 한국어로 자세히 설명하세요."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "이 사진을 보고 작물 종류, 추정 병명, 발생 원인, 방제 방법을 자세히 알려주세요."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64}`
                }
              }
            ]
          }
        ],
        temperature: 0.2,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({
        ok: false,
        error: `OpenAI API 오류: ${errText}`
      });
    }

    const data = await response.json();
    const aiResult = data.choices?.[0]?.message?.content;

    if (!aiResult) {
      return NextResponse.json({
        ok: false,
        error: "AI 응답을 해석할 수 없습니다."
      });
    }

    // ✅ 프론트와 100% 호환되는 응답 형태
    return NextResponse.json({
      ok: true,
      result: aiResult
    });
  } catch (error: any) {
    console.error("AI 진단 오류:", error);

    return NextResponse.json({
      ok: false,
      error: error?.message || "서버 내부 오류"
    });
  }
}
