import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const image = formData.get("image");

    if (!image || !(image instanceof File)) {
      return NextResponse.json({
        ok: false,
        error: "이미지 파일이 전달되지 않았습니다."
      });
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    const base64 = buffer.toString("base64");

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        ok: false,
        error: "OPENAI_API_KEY가 설정되지 않았습니다."
      });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.2,
        max_tokens: 1400,
        messages: [
          {
            role: "system",
            content: `
당신은 "농업 병해충 사진 판독 전문가"입니다.

반드시 업로드된 실제 사진만을 근거로 분석하십시오.
추측이나 템플릿 답변을 금지합니다.
사진에서 식별되지 않으면 반드시 "정확한 작물 식별 불가"라고 명시하세요.
`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `
아래 사진을 실제로 판독하여 다음 순서로 정확히 진단하세요.

1. 작물 판별 (불확실 시 불확실하다고 명시)
2. 증상 관찰 내용
3. 가능한 병해 또는 해충 추정
4. 발생 원인
5. 방제 방법
6. 예방 관리 요령

사진에 없는 것은 상상하지 마세요.
`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64}`
                }
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const e = await response.text();
      return NextResponse.json({
        ok: false,
        error: e
      });
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content;

    if (!result) {
      return NextResponse.json({
        ok: false,
        error: "AI 결과를 해석할 수 없습니다."
      });
    }

    return NextResponse.json({
      ok: true,
      result
    });

  } catch (err: any) {
    console.error("AI 분석 오류:", err);
    return NextResponse.json({
      ok: false,
      error: err?.message || "서버 오류"
    });
  }
}

