import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const ct = req.headers.get("content-type") || "";

    if (!ct.includes("multipart/form-data")) {
      return NextResponse.json({
        ok: false,
        error: "잘못된 업로드 형식",
      });
    }

    const formData = await req.formData();
    const image = formData.get("image");

    if (!(image instanceof File)) {
      return NextResponse.json({
        ok: false,
        error: "이미지 파일 없음",
      });
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    const base64 = buffer.toString("base64");

    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      return NextResponse.json({
        ok: false,
        error: "OPENAI_API_KEY 누락",
      });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0.15,
        max_tokens: 1200,
        messages: [
          {
            role: "system",
            content:
              "당신은 한국 농업 병해 전문가입니다. 사진의 작물을 먼저 정확히 판별하고, 추정 병해·해충 원인을 상세히 기술하세요. 모호하면 불확실하다고 명시하세요. 임의 단정 금지.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "사진을 분석해 아래를 정확하게 작성하세요:\n\n1. 작물 종(정확하지 않으면 불확실 표시)\n2. 병명 또는 해충 추정\n3. 주요 증상 근거\n4. 발생 원인\n5. 방제 요령(약제·물리·환경관리 포함)\n6. 예방 관리 수칙",
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
      }),
    });

    if (!response.ok) {
      return NextResponse.json({
        ok: false,
        error: "AI API 오류",
      });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({
        ok: false,
        error: "AI 응답 없음",
      });
    }

    return NextResponse.json({
      ok: true,
      result: content,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({
      ok: false,
      error: "서버 오류",
    });
  }
}
