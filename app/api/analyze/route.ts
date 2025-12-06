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

    // ---- 파일 → BASE64 변환 ----
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");

    // ---- 농업 전문 진단 프롬프트 ----
    const prompt = `
너는 대한민국 농업 병해충 전문 진단 AI다.

아래 사진을 기반으로 반드시 다음 항목을 포함하여
**농민이 실제로 바로 대응할 수 있을 수준의 상세 리포트 형식으로 작성하라.**

반드시 아래 구조 유지:

[추정 작물]
작물명 + (신뢰도 %)

[의심 병해충]
- 1번 후보
- 2번 후보
- 3번 후보

[판단 근거]
사진 속 주요 증상 설명

[발생 환경]
기후·토양·수분·재배 조건 분석

[방제 방법]
1) 친환경 방제
2) 약제 방제(등록 성분 기준)
3) 살포 타이밍

[예방 관리 요령]
재발 방지 수칙

[농가 즉시 행동 체크리스트]
- 오늘 할 일
- 일주일 관리 항목
`;

    // ---- GPT 호출 ----
    const response = await client.responses.create({
      model: "gpt-4.1",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            {
              type: "input_image",
              image_base64: base64,
            },
          ],
        },
      ],
      max_output_tokens: 700,
    });

    // ---- 응답 텍스트 처리 ----
    let output = "";

    if (response.output_text) {
      output = response.output_text;
    } else if (response.output?.length) {
      for (const item of response.output) {
        if (item.type === "message") {
          for (const content of item.content || []) {
            if (content.type === "output_text") {
              output += content.text;
            }
          }
        }
      }
    }

    if (!output.trim()) {
      return NextResponse.json({
        ok: false,
        error: "AI 응답이 비어 있습니다.",
      });
    }

    return NextResponse.json({
      ok: true,
      text: output,
    });

  } catch (err) {
    console.error("AI 분석 실패:", err);

    return NextResponse.json({
      ok: false,
      error: "AI 서버 처리 중 오류가 발생했습니다.",
    });
  }
}
