// app/api/v2/label/route.ts
// 농약·영양제·비료 라벨 사진을 읽어 "라벨에 적힌 내용만" 쉽게 정리한다.
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { normalizeImage } from "../../../../lib/serverImage";

export const runtime = "nodejs";
export const maxDuration = 60;

// 라벨 읽기는 가벼운 모델로 충분하다. Vercel 환경변수 LABEL_MODEL로 바꿀 수 있다.
// 앞의 모델이 이 계정에서 안 되면 다음 모델로 넘어간다 (마지막은 운영 진단이 쓰는 모델).
const MODELS = Array.from(
  new Set([process.env.LABEL_MODEL || "gpt-4.1-mini", "gpt-4o-mini", "gpt-4o"])
);
const MAX_IMAGES = 2;
const MAX_BYTES = 4 * 1024 * 1024;

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
      "dilution": string | null,        // 라벨 표기 그대로 (예: "1,000배")
      "dilution_x": number | null,      // 희석배수 숫자만 (1,000배면 1000). 없으면 null
      "per_10a_amount": number | null,  // "10a당 사용량"이 약제 양으로 적혀 있으면 그 숫자 (예: 3kg이면 3)
      "per_10a_unit": string | null,    // 그 단위 (kg, g, ml, L)
      "spray_l_per_10a": number | null, // "10a당 살포량(물량)"이 리터로 적혀 있으면 그 숫자
      "timing": string | null,
      "max_count": number | null, // 사용 횟수 한도
      "phi_days": number | null   // 수확 며칠 전까지 사용
    }
  ],
  "my_use_index": number | null   // 농민의 작물과 같은 작물이 uses에 있으면 그 줄 번호(0부터). 없으면 null
}

[농민 정보가 주어지면]
- summary는 농민의 작물에 해당하는 줄을 기준으로 쓴다. 그 작물이 라벨에 없으면 summary.where에 "라벨에 (작물명)은 없습니다"라고 분명히 쓴다.
- 농민 정보에 맞춰 숫자를 바꾸거나 계산하지 않는다. 숫자는 라벨 그대로다.
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

    const clean = (v: FormDataEntryValue | null) =>
      typeof v === "string" ? v.replace(/[\r\n]/g, " ").trim().slice(0, 30) : "";
    const crop = clean(formData.get("crop"));
    const farmType = clean(formData.get("farmType"));
    const farmer = crop
      ? `\n[농민 정보] 작물: ${crop}${farmType ? `, 재배 방식: ${farmType}` : ""}`
      : "";

    if (images.length === 0) {
      return NextResponse.json(
        { ok: false, code: "no-image", error: "사진이 서버에 도착하지 않았습니다. 다시 해 주세요." },
        { status: 400 }
      );
    }
    if (images.some((f) => f.size > MAX_BYTES)) {
      return NextResponse.json(
        { ok: false, code: "too-big", error: "사진 용량이 너무 큽니다. '사진 찍기'로 다시 찍어 주세요." },
        { status: 413 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { ok: false, code: "no-key", error: "이 주소에는 AI 열쇠가 등록돼 있지 않아 라벨을 읽을 수 없습니다." },
        { status: 500 }
      );
    }

    // 갤럭시 HEIC·세로 사진도 AI가 읽을 수 있는 JPEG로 맞춘다 (운영 진단과 같은 처리)
    const parts = await Promise.all(
      images.map(async (f) => {
        const n = await normalizeImage(Buffer.from(await f.arrayBuffer()), f.type, f.name);
        return {
          type: "image_url" as const,
          image_url: { url: `data:${n.mime};base64,${n.buffer.toString("base64")}`, detail: "high" as const },
        };
      })
    );

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    let completion: OpenAI.Chat.Completions.ChatCompletion | null = null;
    let lastErr: unknown = null;
    for (const model of MODELS) {
      try {
        completion = await openai.chat.completions.create({
          model,
          temperature: 0,
          max_tokens: 2500,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `이 라벨 사진을 읽고 JSON 형식으로만 답하십시오. 라벨에 없는 내용은 null입니다.${farmer}`,
                },
                ...parts,
              ],
            },
          ],
        });
        break;
      } catch (e) {
        lastErr = e;
        const status = (e as { status?: number })?.status;
        // 모델을 못 쓰는 경우(404·403·400)만 다음 모델로, 그 밖의 오류는 바로 알린다
        if (status !== 404 && status !== 403 && status !== 400) break;
      }
    }
    if (!completion) {
      const status = (lastErr as { status?: number })?.status;
      console.error("❌ LABEL OPENAI ERROR:", lastErr);
      return NextResponse.json(
        {
          ok: false,
          code: `ai-${status ?? "fail"}`,
          error:
            status === 401
              ? "AI 열쇠가 맞지 않습니다."
              : status === 429
                ? "AI 사용 한도에 걸렸습니다. 잠시 뒤 다시 해 주세요."
                : "AI가 라벨을 읽지 못했습니다. 다시 해 주세요.",
        },
        { status: 502 }
      );
    }

    const parsed = safeJsonParse(completion.choices[0].message.content ?? "");
    return NextResponse.json({ ok: true, label: parsed });
  } catch (e: unknown) {
    console.error("❌ LABEL API ERROR:", e);
    return NextResponse.json(
      { ok: false, code: "server", error: "라벨을 읽는 중 오류가 났습니다. 다시 찍어 주세요." },
      { status: 500 }
    );
  }
}
