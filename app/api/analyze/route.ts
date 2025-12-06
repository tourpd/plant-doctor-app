import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({
        ok: false,
        error: "이미지 파일이 전달되지 않았습니다.",
      });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");

    const prompt = `
너는 대한민국 농업 병해충 전문 AI이다.

⚠️ 가장 중요:
- 반드시 사진 속 작물을 정확히 식별하라.
- 확신할 수 없으면 "작물 식별 불가"로 출력하라.
- 추측, 일반화, 임의 판단 절대 금지.

------------------------------------------------

출력 구조:

[작물 식별]
- 작물명:
- 신뢰도(%):

[증상 관찰]
- ①
- ②
- ③

[의심 병해충 TOP3]
- 1위:
- 2위:
- 3위:

[판단 근거]

[방제 대책]
1) 친환경
2) 등록 약제
3) 살포 시기

[재발 방지]

[농민 즉시 행동 체크리스트]
`;

    const response = await client.responses.create({
      model: "gpt-4.1",
      temperature: 0.2,
      input: [
        {
          role: "user",
          content: [
            { type: "input_image", image_base64: base64 },
            { type: "input_text", text: prompt },
          ],
        },
      ],
      max_output_tokens: 800,
    });

    let output = "";

    if (response.output_text) {
      output = response.output_text;
    } else {
      for (const msg of response.output || []) {
        if (msg.type === "message") {
          for (const val of msg.content || []) {
            if (val.type === "output_text") output += val.text;
          }
        }
      }
    }

    if (!output.trim()) {
      return NextResponse.json({
        ok: false,
        error: "AI 응답 생성 실패",
      });
    }

    return NextResponse.json({
      ok: true,
      text: output,
    });

  } catch (err) {
    console.error("AI 분석 에러:", err);
    return NextResponse.json({
      ok: false,
      error: "AI 서버 처리 중 오류 발생",
    });
  }
}
