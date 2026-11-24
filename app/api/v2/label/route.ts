// app/api/v2/label/route.ts
// 농약·영양제·비료 라벨 사진을 읽어 "라벨에 적힌 내용만" 쉽게 정리한다.
import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

// 라벨 읽기는 가벼운 모델로 충분하다. Vercel 환경변수 LABEL_MODEL로 바꿀 수 있다.
const MODEL = process.env.LABEL_MODEL || "gpt-4.1-mini";
const MAX_IMAGES = 2;
const MAX_BYTES = 2 * 1024 * 1024;

const SYSTEM_PROMPT = `
너는 대한민국 농약·비료·영양제 포장 라벨을 읽어 주는 도우미다.

[절대 규칙]
- 사진의 라벨에 실제로 적힌 내용만 옮긴다. 라벨에 없는 내용은 절대 지어내지 않는다.
- 글씨가 안 보이거나 라벨에 없는 항목은 null로 둔다. 추측 금지.
- 희석배수, 사용 시기, 사용 횟수, 수확 전 사용 일수는 숫자를 라벨 그대로 옮긴다.
- 농민이 읽기 쉬운 짧은 우리말로 쓴다.
- 반드시 JSON만 출력한다.

[출력 JSON 형식]
{
  "readable": boolean,            // 제품 라벨로 읽을 수 있으면 true
  "need_more": string | null,     // 더 찍어야 할 면이 있으면 안내 문구 (예: "뒷면 사용법 표를 찍어 주세요")
  "product_name": string | null,
  "maker": string | null,
  "category": "살충제" | "살균제" | "제초제" | "영양제" | "비료" | "기타",
  "ingredient": string | null,    // 주성분과 함량
  "moa_code": string | null,      // 작용기작 표시기호. 라벨에 적힌 그대로 (예: "1a", "다3"). 없으면 null
  "summary": {
    "where": string | null,       // 어디에 쓰나 (작물·병해충)
    "how_much": string | null,    // 물에 얼마나 타나 / 얼마나 주나
    "when": string | null,        // 언제 치나
    "caution": string | null      // 꼭 지킬 주의사항
  },
  "uses": [                       // 라벨의 적용 표. 표가 안 보이면 빈 배열
    {
      "crop": string,
      "target": string | null,
      "dilution": string | null,
      "timing": string | null,
      "max_count": number | null, // 사용 횟수 한도
      "phi_days": number | null   // 수확 며칠 전까지 사용
    }
  ]
}
`;

function safeJsonParse(raw: string): unknown {
  const text = (raw || "").trim();
  try {
    return JSON.parse(text);
  } catch {}
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) return JSON.parse(text.slice(start, end + 1));
  throw new Error("JSON 파싱 실패");
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const images = formData
      .getAll("images")
      .filter((v): v is File => v instanceof File)
      .slice(0, MAX_IMAGES);

    if (images.length === 0) {
      return NextResponse.json(
        { ok: false, error: "사진이 없습니다." },
        { status: 400 }
      );
    }
    if (images.some((f) => f.size > MAX_BYTES)) {
      return NextResponse.json(
        { ok: false, error: "사진이 너무 큽니다." },
        { status: 413 }
      );
    }

    const parts = await Promise.all(
      images.map(async (f) => ({
        type: "image_url" as const,
        image_url: {
          url: `data:image/jpeg;base64,${Buffer.from(await f.arrayBuffer()).toString("base64")}`,
        },
      }))
    );

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0,
      max_tokens: 1500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "이 라벨 사진을 읽고 JSON 형식으로만 답하십시오. 라벨에 없는 내용은 null입니다.",
            },
            ...parts,
          ],
        },
      ],
    });

    const parsed = safeJsonParse(completion.choices[0].message.content ?? "");
    return NextResponse.json({ ok: true, label: parsed });
  } catch (e: unknown) {
    console.error("❌ LABEL API ERROR:", e);
    return NextResponse.json(
      { ok: false, error: "라벨을 읽는 중 오류가 났습니다. 다시 찍어 주세요." },
      { status: 500 }
    );
  }
}
