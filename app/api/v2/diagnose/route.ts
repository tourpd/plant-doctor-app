// app/api/v2/diagnose/route.ts
// 작물 사진 → 의심 원인(병·해충·생리장해) → 내 작물에 "등록된 약"까지 한 번에 돌려준다.
// 약 이름·희석배수는 AI가 지어내지 않는다. 등록 자료(공식·제조사)에서만 가져온다.
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { normalizeImage } from "../../../../lib/serverImage";
import { aiFailure, errCode, isSpendLimit, safeJsonParse } from "../../../v2/lib/aiUtil";
import { OFFICIAL_SOURCE } from "../../../v2/lib/official";
import { findForTarget } from "../../../v2/lib/officialFetch";

export const runtime = "nodejs";
export const maxDuration = 60;

// 진단은 정확도가 중요해 큰 모델을 먼저 쓴다. Vercel 환경변수 DIAG_MODEL로 바꿀 수 있다.
const MODELS = Array.from(new Set([process.env.DIAG_MODEL || "gpt-4o", "gpt-4.1", "gpt-4o-mini"]));
const MAX_IMAGES = 3;
const MAX_BYTES = 4 * 1024 * 1024;

const SYSTEM_PROMPT = `
너는 대한민국 농촌진흥청 병해충 진단 전문가다. 농민이 찍은 작물 사진을 보고 원인을 판단한다.

[절대 규칙]
- 사진에 보이는 증상만 근거로 판단한다. 안 보이는 것은 지어내지 않는다.
- 확실하지 않으면 확률을 낮게 쓰고, 꼭 확인할 것(check)에 무엇을 보면 갈리는지 쓴다.
- 약 이름(상품명)·희석배수는 절대 쓰지 않는다. 약은 등록 자료에서 따로 찾는다.
- 원인 이름(name)은 농약 등록에 쓰는 표준 병해충명으로 짧게 쓴다. 작물 이름을 붙이지 않는다.
  예: "탄저병", "역병", "흰가루병", "노균병", "잿빛곰팡이병", "목화진딧물", "꽃노랑총채벌레", "담배가루이", "점박이응애", "담배나방"
- 비료·물·온도 문제는 kind를 "생리장해" 또는 "환경"으로 쓴다 (예: "칼슘 결핍(배꼽썩음)", "고온 장해").
- 농민이 읽기 쉬운 짧은 우리말로 쓴다. 반드시 JSON만 출력한다.

[출력 JSON 형식]
{
  "readable": boolean,              // 작물(잎·줄기·열매·뿌리)이 보여 진단할 수 있으면 true
  "retake": string | null,          // 진단하기 어려우면 어떻게 다시 찍을지 (예: "잎 뒷면을 가까이 찍어 주세요")
  "crop_seen": string | null,       // 사진 속 작물로 보이는 것
  "crop_mismatch": boolean,         // 농민이 말한 작물과 사진 속 작물이 분명히 다르면 true
  "causes": [                       // 가능성 높은 순서로 최대 3개
    {
      "name": string,
      "kind": "병해" | "해충" | "생리장해" | "환경",
      "confidence": number,         // 0~100
      "why": string                 // 사진에서 본 근거 한두 문장
    }
  ],
  "now": string[],                  // 지금 바로 할 일 (약 이름 없이) 최대 4개
  "dont": string[],                 // 하지 말 것 최대 3개
  "check": string[]                 // 원인을 가르려면 확인할 것 최대 3개
}
`;

type Cause = { name: string; kind: string; confidence: number; why: string };

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
    const region = clean(formData.get("region"));
    const month = new Date().getMonth() + 1;

    if (images.length === 0) {
      return NextResponse.json({ ok: false, code: "no-image", error: "작물 사진이 없습니다." }, { status: 400 });
    }
    if (images.some((f) => f.size > MAX_BYTES)) {
      return NextResponse.json(
        { ok: false, code: "too-big", error: "사진 용량이 너무 큽니다. '사진 찍기'로 다시 찍어 주세요." },
        { status: 413 }
      );
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { ok: false, code: "no-key", error: "이 주소에는 AI 열쇠가 등록돼 있지 않아 진단할 수 없습니다." },
        { status: 500 }
      );
    }

    const parts = await Promise.all(
      images.map(async (f) => {
        const n = await normalizeImage(Buffer.from(await f.arrayBuffer()), f.type, f.name);
        return {
          type: "image_url" as const,
          image_url: { url: `data:${n.mime};base64,${n.buffer.toString("base64")}`, detail: "high" as const },
        };
      })
    );
    const farmer = [
      crop && `작물: ${crop}`,
      farmType && `재배 방식: ${farmType}`,
      region && `지역: ${region}`,
      `지금: ${month}월`,
    ]
      .filter(Boolean)
      .join(", ");

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    let completion: OpenAI.Chat.Completions.ChatCompletion | null = null;
    let lastErr: unknown = null;
    for (const model of MODELS) {
      try {
        completion = await openai.chat.completions.create({
          model,
          temperature: 0.1,
          max_tokens: 1400,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: [{ type: "text", text: `[농민 정보] ${farmer}\n이 사진을 진단해 JSON으로만 답하십시오.` }, ...parts],
            },
          ],
        });
        break;
      } catch (e) {
        lastErr = e;
        const status = (e as { status?: number })?.status;
        if (errCode(e) === "insufficient_quota" || isSpendLimit(e)) break;
        if (status === 429) await new Promise((r) => setTimeout(r, 2000));
        else if (status !== 404 && status !== 403 && status !== 400) break;
      }
    }
    if (!completion) {
      console.error("❌ DIAG OPENAI ERROR:", lastErr);
      return NextResponse.json({ ok: false, ...aiFailure(lastErr, "진단할 수") }, { status: 502 });
    }

    const parsed = safeJsonParse(completion.choices[0].message.content ?? "") as {
      readable?: boolean;
      retake?: string | null;
      crop_seen?: string | null;
      crop_mismatch?: boolean;
      causes?: Cause[];
      now?: string[];
      dont?: string[];
      check?: string[];
    };
    const causes = (Array.isArray(parsed.causes) ? parsed.causes : [])
      .filter((c) => c && typeof c.name === "string" && c.name.trim())
      .slice(0, 3)
      .map((c) => ({
        name: c.name.trim().slice(0, 30),
        kind: ["병해", "해충", "생리장해", "환경"].includes(c.kind) ? c.kind : "병해",
        confidence: Math.max(0, Math.min(100, Math.round(Number(c.confidence) || 0))),
        why: String(c.why ?? "").slice(0, 200),
      }));

    // 병·해충이면 내 작물에 등록된 약을 자료에서 찾아 붙인다 (AI가 약 이름을 지어내지 않게)
    const withRx = await Promise.all(
      causes.map(async (c) => {
        if (!crop || (c.kind !== "병해" && c.kind !== "해충") || c.confidence < 15) {
          return { ...c, rx: null };
        }
        const r = await findForTarget(crop, c.name);
        return {
          ...c,
          rx: {
            ok: r.ok,
            code: r.ok ? null : r.code,
            target: r.ok ? r.target : null,
            products: r.products.slice(0, 15),
          },
        };
      })
    );

    return NextResponse.json({
      ok: true,
      source: OFFICIAL_SOURCE,
      diagnosis: {
        readable: parsed.readable !== false,
        retake: parsed.retake ?? null,
        crop_seen: parsed.crop_seen ?? null,
        crop_mismatch: !!parsed.crop_mismatch,
        causes: withRx,
        now: (parsed.now ?? []).slice(0, 4),
        dont: (parsed.dont ?? []).slice(0, 3),
        check: (parsed.check ?? []).slice(0, 3),
      },
    });
  } catch (e: unknown) {
    console.error("❌ DIAG API ERROR:", e);
    return NextResponse.json(
      { ok: false, code: "server", error: "진단 중 오류가 났습니다. 다시 찍어 주세요." },
      { status: 500 }
    );
  }
}
