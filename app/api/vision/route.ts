// app/api/vision/route.ts
// @ts-nocheck
import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

/* ===============================
 * OpenAI Client
 * =============================== */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/* ===============================
 * 질문 타입 정의 (BASECAMP 고정)
 * - 주관식 단독 질문 제거
 * - 객관식 + 농민 의견 기록만 허용
 * =============================== */
type Question = {
  id: string;
  kind: "CHOICE";
  text: string;
  choices: string[];

  // ✅ 객관식 내부에서 농민 의견(메모) 입력 허용
  allow_note?: boolean;
  note_placeholder?: string;
};

/* ===============================
 * 히스토리 타입 (vision 전용 최소 정의)
 * =============================== */
export type HistoryItem =
  | {
      role: "doctor";
      kind?: string;
      text: string;
    }
  | {
      role: "farmer";
      qid: string;
      answer: string | string[];
      note?: string; // ← allow_note 로 입력된 농민 의견
      kind?: "CHOICE";
    };


/** =========================
 *  Types
 * ========================= */
type PrimaryCategory = "DISEASE" | "PEST" | "ENVIRONMENT" | "GROWTH";
type CropGuess = { name: string; confidence: number };


type Progress = { asked: number; target: number };

type ApiResponse =
  | ({
      ok: true;
    } & (
      | {
          phase: "QUESTION";
          primary_category?: PrimaryCategory | null;
          crop_guess: CropGuess;
          observations: string[];
          doctor_note: string;
          question: Question;
          progress: Progress;
        }
      | {
          phase: "FINAL";
          primary_category?: PrimaryCategory | null;
          crop_guess: CropGuess;
          observations: string[];
          possible_causes: { name: string; probability: number; why: string }[];
          must_check: string[];
          do_not: string[];
          next_steps: string[];
          need_119_if: string[];
          followup_message: string;
        }
    ))
  | { ok: false; error: string };

/** =========================
 *  Helpers
 * ========================= */
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function normalizeText(s: unknown) {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .replace(/과일/g, "열매")
    .replace(/농민님/g, "농부님")
    .trim();
}

function makeBase64DataUrl(buffer: Buffer, mime: string) {
  const b64 = buffer.toString("base64");
  return `data:${mime || "image/jpeg"};base64,${b64}`;
}

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function farmerLabel() {
  return "농부님";
}

/** =========================
 *  TEXT → signal
 * ========================= */
type TextSignal =
  | "FRUIT_SYMPTOM"
  | "LEAF_SYMPTOM"
  | "STEM_SYMPTOM"
  | "FUNGAL_HINT"
  | "PEST_HINT"
  | "VIRUS_HINT"
  | "FAST_SPREAD"
  | "SLOW_SPREAD"
  | "WATER_STRESS"
  | "NUTRIENT_EXCESS"
  | "NUTRIENT_DEF"
  | "COLD_DAMAGE"
  | "HEAT_DAMAGE";

function signalizeText(raw: string): TextSignal[] {
  const t = normalizeText(raw);
  if (!t) return [];
  const signals = new Set<TextSignal>();

  if (/(열매|고추|과|꼭지)/.test(t)) signals.add("FRUIT_SYMPTOM");
  if (/(잎|엽|잎사귀)/.test(t)) signals.add("LEAF_SYMPTOM");
  if (/(줄기|마디|대)/.test(t)) signals.add("STEM_SYMPTOM");

  if (/(곰팡|균|탄저|역병)/.test(t)) signals.add("FUNGAL_HINT");
  if (/(바이러스|모자이크|뒤틀)/.test(t)) signals.add("VIRUS_HINT");
  if (/(벌레|해충|진딧물|총채|응애|파먹|구멍)/.test(t)) signals.add("PEST_HINT");

  if (/(하루|이틀|갑자기|급격)/.test(t)) signals.add("FAST_SPREAD");
  if (/(서서히|천천히)/.test(t)) signals.add("SLOW_SPREAD");

  if (/(물|관수|과습|건조|축 처짐)/.test(t)) signals.add("WATER_STRESS");
  if (/(질소|요소|웃자람|잎색 진함)/.test(t)) signals.add("NUTRIENT_EXCESS");
  if (/(결핍|칼슘|마그네슘|황화|석회)/.test(t)) signals.add("NUTRIENT_DEF");

  if (/(냉해|서리|한파)/.test(t)) signals.add("COLD_DAMAGE");
  if (/(고온|열|타들)/.test(t)) signals.add("HEAT_DAMAGE");

  return Array.from(signals);
}

/** =========================
 *  FREE_TEXT 의도(간단) — 질문 선택 보조
 * ========================= */
type IntentSignal = "WATER_STRESS" | "NUTRIENT_EXCESS" | "NUTRIENT_DEF" | "PEST_HINT" | "FUNGAL_HINT" | "VIRUS_HINT";

function extractIntentFromFreeText(text: string): IntentSignal[] {
  const t = normalizeText(text);
  const out = new Set<IntentSignal>();

  if (t.includes("물") || t.includes("관수") || t.includes("과습") || t.includes("건조")) out.add("WATER_STRESS");
  if (t.includes("웃자람") || t.includes("질소") || t.includes("요소")) out.add("NUTRIENT_EXCESS");
  if (t.includes("칼슘") || t.includes("석회") || t.includes("황화") || t.includes("결핍")) out.add("NUTRIENT_DEF");
  if (t.includes("진딧물") || t.includes("총채") || t.includes("응애") || t.includes("벌레") || t.includes("구멍")) out.add("PEST_HINT");
  if (t.includes("곰팡") || t.includes("탄저") || t.includes("역병") || t.includes("균")) out.add("FUNGAL_HINT");
  if (t.includes("바이러스") || t.includes("모자이크") || t.includes("뒤틀")) out.add("VIRUS_HINT");

  return Array.from(out);
}

/** =========================
 *  Question Pools (v1)
 * ========================= */

const Q_DISEASE_POOL: Question[] = [
  {
    id: "D1_SPREAD_SPEED",
    kind: "CHOICE",
    text: "증상이 퍼지는 속도는 어떤가요?",
    choices: ["하루 이틀 사이 급격히 퍼진다", "서서히 늘어난다", "거의 변화가 없다", "잘 모르겠다", "기타(직접 입력)"],
  },
  {
    id: "D2_LOCATION",
    kind: "CHOICE",
    text: "증상이 주로 어디에서 시작된 것 같나요?",
    choices: ["잎(특히 아래 잎)부터", "새잎이나 생장점부터", "줄기나 마디", "열매", "밭이나 하우스 일부 구역만", "전체적으로", "잘 모르겠다", "기타(직접 입력)"],
  },
  {
    id: "D3_INSECT_TRACE",
    kind: "CHOICE",
    text: "잎 뒷면에 벌레나 끈적임, 검은 그을음 같은 흔적이 보이나요?",
    choices: ["예", "아니오", "잘 모르겠다", "기타(직접 입력)"],
  },
  {
    id: "D4_WEATHER_TRIGGER",
    kind: "CHOICE",
    text: "최근 날씨나 관리 방법에 변화가 있었나요?",
    choices: ["비가 오거나 습도가 갑자기 높아졌다", "갑작스러운 한파나 냉해가 있었다", "고온이나 강한 햇빛이 이어졌다", "약이나 비료를 새로 바꿨다", "큰 변화는 없었다", "잘 모르겠다", "기타(직접 입력)"],
  },
  {
    id: "D5_SPRAY_HISTORY",
    kind: "CHOICE",
    text: "최근 7일 안에 어떤 처리를 하셨나요?",
    choices: ["살균제를 사용했다", "살충제를 사용했다", "영양제나 엽면시비를 했다", "아무것도 하지 않았다", "기억이 정확하지 않다", "기타(직접 입력)"],
  },
];

const Q_GROWTH_POOL: Question[] = [
  {
    id: "G1_GROWTH_SPEED",
    kind: "CHOICE",
    text: "최근 생육 속도는 어떤가요?",
    choices: ["정상적으로 잘 자라고 있다", "갑자기 빨라졌다(웃자람 느낌)", "눈에 띄게 느려졌다", "거의 멈춘 것 같다", "잘 모르겠다", "기타(직접 입력)"],
  },
  {
    id: "G2_LEAF_STEM_FEEL",
    kind: "CHOICE",
    text: "잎이나 줄기의 상태는 어떤가요?",
    choices: ["잎이 두껍고 단단하다", "잎은 큰데 연하고 축 처진다", "웃자람 느낌이 있다", "잎 색이 너무 진하다", "잎 색이 연해지거나 황화된다", "잘 모르겠다", "기타(직접 입력)"],
  },
  {
    id: "G3_WATER_PATTERN",
    kind: "CHOICE",
    text: "물 주는 방식은 어떤가요?",
    choices: ["자주 조금씩 준다", "한 번에 많이 준다", "건조했다가 몰아서 준다", "비나 자연강우 위주다", "잘 모르겠다", "기타(직접 입력)"],
  },
  {
    id: "G4_FEED_STYLE",
    kind: "CHOICE",
    text: "비료나 영양제는 어떤 편인가요?",
    choices: ["강하게 주는 편이다", "보통이다", "약하게 주는 편이다", "유기농·친환경 자재만 사용한다", "기억이 정확하지 않다", "기타(직접 입력)"],
  },
  {
    id: "G5_FEED_RECENT",
    kind: "CHOICE",
    text: "최근 10일 안에 하신 것(해당되는 것 모두)을 골라주세요.",
    choices: ["엽면시비", "관수 패턴 변경", "요소나 질소계 투입", "가리나 칼륨계 투입", "석회나 칼슘 투입", "아무것도 안 했다", "기억이 정확하지 않다", "기타(직접 입력)"],
  },
];

/** =========================
 *  Signal scoring (v1)
 * ========================= */
type SignalKey = "pest" | "fungal" | "viral" | "physio" | "nutrient_excess" | "nutrient_def" | "water_stress" | "cold_heat";

function mergeSignals(base: Record<SignalKey, number>, add: Record<SignalKey, number>) {
  const out = { ...base };
  (Object.keys(add) as SignalKey[]).forEach((k) => {
    out[k] = (out[k] ?? 0) + (add[k] ?? 0);
  });
  return out;
}

function scoreFromAnswer(qid: string, answer: string | string[]) {
  const arr = Array.isArray(answer) ? answer : [answer];
  const a = arr.map((x) => normalizeText(x));
  const has = (kw: string) => a.some((x) => x.includes(kw));

  const s: Record<SignalKey, number> = {
    pest: 0,
    fungal: 0,
    viral: 0,
    physio: 0,
    nutrient_excess: 0,
    nutrient_def: 0,
    water_stress: 0,
    cold_heat: 0,
  };

  // 🔥 FREE_TEXT_OPINION
  if (qid === "FREE_TEXT_OPINION") {
    const t = a.join(" ");
    if (t.includes("바이러스")) s.viral += 8;
    if (t.includes("곰팡") || t.includes("탄저") || t.includes("역병")) s.fungal += 7;
    if (t.includes("진딧물") || t.includes("총채") || t.includes("응애")) s.pest += 7;

    if (t.includes("열매")) {
      s.fungal += 4;
      s.pest += 3;
    }

    if (t.includes("웃자람") || t.includes("질소") || t.includes("요소")) s.nutrient_excess += 6;
    if (t.includes("칼슘") || t.includes("석회") || t.includes("결핍")) s.nutrient_def += 6;

    if (t.includes("물") || t.includes("관수") || t.includes("과습") || t.includes("건조")) s.water_stress += 6;
    if (t.includes("냉해") || t.includes("한파")) s.cold_heat += 6;
    if (t.includes("고온") || t.includes("열") || t.includes("햇빛")) s.cold_heat += 5;
  }

  // 기본 질문(중복 블록 없음 — 사용자 요청대로 “객관식 질문 신호” 블록 삭제)
  if (qid === "D1_SPREAD_SPEED") {
    if (has("급격")) {
      s.viral += 2;
      s.pest += 1;
    }
    if (has("서서히")) s.fungal += 1;
  }

  if (qid === "D3_INSECT_TRACE") {
    if (has("예")) s.pest += 3;
    if (has("끈적") || has("그을음")) s.pest += 1;
  }

  if (qid === "D4_WEATHER_TRIGGER") {
    if (has("비") || has("습도")) s.fungal += 2;
    if (has("한파") || has("냉해")) s.cold_heat += 2;
    if (has("고온") || has("햇빛")) s.cold_heat += 1;
    if (has("약") || has("비료")) s.physio += 1;
  }

  if (qid === "G1_GROWTH_SPEED") {
    if (has("웃자람") || has("빨라")) s.nutrient_excess += 2;
    if (has("느려") || has("멈")) {
      s.water_stress += 1;
      s.nutrient_def += 1;
    }
  }

  if (qid === "G2_LEAF_STEM_FEEL") {
    if (has("너무 진") || has("진하")) s.nutrient_excess += 2;
    if (has("황화") || has("연해")) s.nutrient_def += 2;
    if (has("축 처짐") || has("연하")) s.water_stress += 2;
  }

  if (qid === "G3_WATER_PATTERN") {
    if (has("건조") || has("몰아서")) s.water_stress += 3;
    if (has("자주")) s.water_stress += 1;
  }

  if (qid === "G4_FEED_STYLE") {
    if (has("강하게")) s.nutrient_excess += 2;
    if (has("약하게")) s.nutrient_def += 1;
  }

  // ✅ G5_FEED_RECENT
  if (qid === "G5_FEED_RECENT") {
    const t = a.join(" ");
    if (t.includes("요소") || t.includes("질소")) s.nutrient_excess += 3;
    if (t.includes("가리") || t.includes("칼륨")) s.physio += 1;
    if (t.includes("석회") || t.includes("칼슘")) s.nutrient_def += 2;
    if (t.includes("엽면")) s.physio += 1;
    if (t.includes("관수")) s.water_stress += 3;
    if (t.includes("아무것도")) {
      s.nutrient_def += 1;
      s.water_stress += 1;
    }
  }

  return s;
}

function pickTop3(signals: Record<SignalKey, number>) {
  const entries = Object.entries(signals)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  const top = entries.slice(0, 3);
  const total = top.reduce((sum, [, v]) => sum + v, 0) || 1;

  return top.map(([key, value]) => ({
    key: key as SignalKey,
    probability: Math.round((value / total) * 100),
  }));
}

function humanizeCause(key: SignalKey, cropName: string) {
  const crop = cropName ? `(${cropName})` : "";
  switch (key) {
    case "pest":
      return { name: `해충 피해 가능성${crop}`, why: "잎이나 열매에 끈적임, 구멍, 벌레 흔적이 보일 때 자주 나타납니다." };
    case "fungal":
      return { name: `곰팡이성 병해 가능성${crop}`, why: "비 온 뒤 심해지거나 습한 환경에서 빠르게 번지는 경우가 많습니다." };
    case "viral":
      return { name: `바이러스 의심${crop}`, why: "짧은 기간에 확 퍼지고 잎이 뒤틀리거나 생육이 멈출 때 의심됩니다." };
    case "nutrient_excess":
      return { name: `영양 과다 가능성${crop}`, why: "웃자람, 잎 색이 지나치게 진해질 때 나타날 수 있습니다." };
    case "nutrient_def":
      return { name: `영양 결핍 가능성${crop}`, why: "잎이 연해지거나 황화되고 생육이 더뎌질 때 흔합니다." };
    case "water_stress":
      return { name: `수분 스트레스 가능성${crop}`, why: "과습·건조가 반복되면 잎 처짐과 생육 정체가 옵니다." };
    case "cold_heat":
      return { name: `온도 스트레스 가능성${crop}`, why: "냉해나 고온 이후 병처럼 보이는 증상이 나타날 수 있습니다." };
    default:
      return { name: `생리장해 가능성${crop}`, why: "환경 변화나 약해로 인한 일시적 이상일 수 있습니다." };
  }
}

/** =========================
 *  Vision analysis (first step)
 * ========================= */
async function visionFirstRead(imageUrl: string, cropHint: string, regionHint: string) {
  const model = process.env.OPENAI_MODEL_VISION || "gpt-4o-mini";

  const system = [
  "당신은 '포토닥터'의 1차 판독 AI입니다.",
  `호칭은 반드시 "${farmerLabel()}"로 합니다.`,
  "출력은 반드시 JSON 한 덩어리로만 출력합니다(설명문 금지).",
  "사진에서 '보이는 것'만 관찰로 쓰고, 단정 금지.",
  "농부가 신뢰할 수 있는 구체 관찰 3~6줄 작성.",
  "primary_category는 아래 중 하나로만 선택:",
  "DISEASE / PEST / GROWTH / ENVIRONMENT",
  "모호하면 DISEASE로 몰지 말고 GROWTH 또는 ENVIRONMENT 우선.",
  "모든 observations, doctor_note는 반드시 한국어로 작성합니다.",
  "영어, 로마자, 학술 용어를 그대로 사용하지 마십시오."
].join("\n");


  const user = [
    `작물 힌트: ${cropHint || "(없음)"}`,
    `지역 힌트: ${regionHint || "(없음)"}`,
    "아래 형식의 JSON만 출력:",
    "{",
    '  "crop_guess": {"name":"", "confidence": 0},',
    '  "primary_category": "DISEASE|PEST|GROWTH|ENVIRONMENT",',
    '  "observations": ["...","..."],',
    '  "doctor_note": "농부님이 사진을 제대로 봤다고 느낄 2~4문장",',
    '  "initial_risk": "LOW|MID|HIGH"',
    "}",
  ].join("\n");

  const resp = await openai.responses.create({
    model,
    input: [
      { role: "system", content: system },
      {
        role: "user",
        content: [
          { type: "input_text", text: user },
          { type: "input_image", image_url: imageUrl, detail: "auto" }
        ],
      },
    ],
  });

  const rawText = (resp.output_text || "").trim();

  const parsed = safeJsonParse(rawText, {
    crop_guess: { name: cropHint || "", confidence: cropHint ? 0.6 : 0.3 },
    primary_category: "GROWTH" as PrimaryCategory, // ✅ 모호하면 성장/환경 우선
    observations: ["사진에서 확인 가능한 정보가 제한적입니다.", "조명이나 초점이 더 선명하면 정확도가 올라갑니다."],
    doctor_note: `${farmerLabel()} 사진만으로는 단정하기 어렵습니다. 몇 가지 핵심을 더 확인하겠습니다.`,
    initial_risk: "MID" as "LOW" | "MID" | "HIGH",
  });

  const cg = parsed.crop_guess ?? { name: cropHint || "", confidence: 0.3 };

  return {
    crop_guess: {
      name: normalizeText(cg.name) || cropHint || "미상",
      confidence: clamp(Number(cg.confidence ?? 0.3), 0, 1),
    },
    primary_category: (parsed.primary_category as PrimaryCategory) || "GROWTH",
    observations: Array.isArray(parsed.observations) ? parsed.observations.map(normalizeText).filter(Boolean).slice(0, 8) : [],
    doctor_note: normalizeText(parsed.doctor_note) || `${farmerLabel()} 추가 확인으로 정확도를 높이겠습니다.`,
    initial_risk: parsed.initial_risk || "MID",
  };
}
/* ===============================
 * 질문 흐름 제어 상수 (BASECAMP 고정)
 * =============================== */
const TARGET_QUESTIONS = 3;      // 실제로 묻는 개수(예: 3)
const MAX_QUESTIONS = 5;         // 풀에서 최대치(5개 제한)

/** =========================
 *  State machine
 * ========================= */
function buildAskedQids(history: HistoryItem[]) {
  return uniq(
    history
      .filter((h) => h.role === "farmer")
      .map((h) => (h as any).qid)
      .filter(Boolean)
  );
}

  function chooseNextQuestion(
  primary: PrimaryCategory,
  asked: string[],
  history: HistoryItem[]
) {

  // 🔥 0️⃣ 사진/텍스트 기반 "강한 신호"가 있으면, 설문형 기본질문을 스킵하고
  //    그 신호에 맞는 "정밀 1문항"을 먼저 던진다. (하나만, 1회)
  const textSignals: string[] = history
    .filter((h: any) => h.role === "doctor" && h.kind === "__TEXT_SIGNAL__")
    .flatMap((h: any) => safeJsonParse<string[]>(h.text, []));

  // 0️⃣ 슬롯 우선순위 (원하시는대로 순서 바꾸면 됨)
  const SLOT0_PRIORITY: Array<{
    key: string;
    // 이미 물어본 상태면 스킵하기 위한 qid
    qid: string;
    // 실제로 물을 질문
    q: Question;
  }> = [
    {
      key: "PEST_HINT",
      qid: "PEST_CHECK_1",
      q: {
        id: "PEST_CHECK_1",
        kind: "CHOICE",
        text: "잎 뒷면에 ‘작은 벌레(진딧물/총채/응애)’가 실제로 보이나요?",
        choices: ["예(보인다)", "아니오(안 보인다)", "잘 모르겠다(확대가 필요)"],
      },
    },
    {
      key: "VIRUS_HINT",
      qid: "VIRUS_CHECK_1",
      q: {
        id: "VIRUS_CHECK_1",
        kind: "CHOICE",
        text: "새잎이 ‘뒤틀림/모자이크(얼룩무늬)’처럼 변한 게 보이나요?",
        choices: ["예(뚜렷하다)", "애매하다", "아니다"],
      },
    },
    {
      key: "FUNGAL_HINT",
      qid: "FUNGAL_CHECK_1",
      q: {
        id: "FUNGAL_CHECK_1",
        kind: "CHOICE",
        text: "반점이 ‘동그랗게 번지거나 테두리’가 생기고, 습할 때 더 심해지나요?",
        choices: ["예(그렇다)", "아니다", "잘 모르겠다"],
      },
    },
    {
      key: "WATER_STRESS",
      qid: "WATER_CHECK_1",
      q: {
        id: "WATER_CHECK_1",
        kind: "CHOICE",
        text: "최근 3~7일에 ‘과습/건조’가 반복되었나요?",
        choices: ["예", "아니오", "잘 모르겠다"],
      },
    },
    {
      key: "NUTRIENT_EXCESS",
      qid: "NUTRIENT_CHECK_1",
      q: {
        id: "NUTRIENT_CHECK_1",
        kind: "CHOICE",
        text: "질소를 세게 준 뒤 ‘웃자람(연약·연녹색·길쭉)’이 느껴지나요?",
        choices: ["예", "아니오", "잘 모르겠다"],
      },
    },
    {
      key: "NUTRIENT_DEF",
      qid: "NUTRIENT_CHECK_2",
      q: {
        id: "NUTRIENT_CHECK_2",
        kind: "CHOICE",
        text: "아래잎부터 ‘황화(노래짐)’가 먼저 오나요?",
        choices: ["예", "아니오", "잘 모르겠다"],
      },
    },
  ];

  // ✅ 0️⃣ 슬롯은 "최초 1개"만 개입
  // 이미 0슬롯 질문을 한 번이라도 던졌으면 재개입 금지
  const alreadyUsedSlot0 = asked.some((qid) =>
    [
      "PEST_CHECK_1",
      "VIRUS_CHECK_1",
      "FUNGAL_CHECK_1",
      "WATER_CHECK_1",
      "NUTRIENT_CHECK_1",
      "NUTRIENT_CHECK_2",
    ].includes(qid)
  );

  if (!alreadyUsedSlot0 && textSignals.length > 0) {
    const picked = SLOT0_PRIORITY.find(
      (rule) => textSignals.includes(rule.key) && !asked.includes(rule.qid)
    );
    if (picked) return picked.q;
  }

    return null;
}

function shouldFinalize(askedQids: string[], minQuestions: number) {
  const hasFreeText = askedQids.includes("FREE_TEXT");
  return askedQids.length >= minQuestions && hasFreeText;
}
/** =========================
 *  FINAL builder (베이스캠프 고정판 + 캡 적용)
 * ========================= */
function buildFinal(history: HistoryItem[], crop: string) {
  // 1️⃣ signal 초기화
  let signals: Record<SignalKey, number> = {
    pest: 0,
    fungal: 0,
    viral: 0,
    physio: 0,
    nutrient_excess: 0,
    nutrient_def: 0,
    water_stress: 0,
    cold_heat: 0,
  };

  // 2️⃣ 객관식/단답 질문 신호 합산
  const answers = history.filter(
    (h) => h.role === "farmer"
  ) as Extract<HistoryItem, { role: "farmer" }>[];

  answers.forEach((a) => {
    signals = mergeSignals(signals, scoreFromAnswer(a.qid, a.answer));
  });


  // 4️⃣ FREE_TEXT → 농부 발언 요약 (결과 상단 노출)
  const farmerTexts = history
    .filter((h) => h.role === "farmer" && h.kind === "FREE_TEXT")
    .map((h: any) => String(h.answer || "").trim())
    .filter(Boolean);

  const farmer_summary =
    farmerTexts.length > 0
      ? `농부님 말씀에 따르면 ${farmerTexts[farmerTexts.length - 1]}`
      : null;

  // 5️⃣ Top3 계산
  let top3 = pickTop3(signals);

  // 6️⃣ 🔒 바이러스 과확신 방지 캡
  const virusConfirmed = history.some(
    (h: any) =>
      h.role === "farmer" &&
      ["VIRUS_CHECK_1", "VIRUS_CHECK_2"].includes(h.qid) &&
      String(h.answer).includes("예")
  );

  top3 = top3.map((t) => {
    let capped = t.probability;

    // 바이러스 단독 캡
    if (t.key === "viral" && !virusConfirmed) {
      capped = Math.min(capped, 60);
    }

    // 전체 공통 캡 (확률 튐 방지)
    capped = Math.min(capped, 75);

    return { ...t, probability: capped };
  });

  // 7️⃣ 농가용 표현 변환
  const possible_causes = top3.map((t) => {
    const base = humanizeCause(t.key, crop);
    return {
      name: stripEnglish([base.name])[0] ?? base.name,
      probability: t.probability,
      why: stripEnglish([base.why]).join(" "),
    };
  });

  // 8️⃣ 공통 가이드
  const must_check: string[] = [
    "같은 증상이 새잎이나 생장점에도 있는지 확인",
    "잎 뒷면에 해충·끈적임·그을음 흔적이 있는지 확대 확인",
    "밭이나 하우스에서 일부만 그런지, 전체로 퍼지는지 확인",
  ];

  const do_not: string[] = [
    "원인 확정 전에 살균·살충·영양제를 한 번에 섞어 과다 처리하지 마세요.",
    "물 주기를 갑자기 바꾸지 마세요(과습·건조 반복은 증상을 악화시킵니다).",
  ];

  const next_steps: string[] = [
    "오늘은 확인 1~2가지만 더 해서 원인 범위를 좁힙니다.",
    "2~3일 후 같은 각도로 다시 촬영하면 변화 신호를 더 정확히 잡을 수 있습니다.",
  ];

  const need_119_if: string[] = [
    "하루 사이 급격히 번지며 잎이 대량으로 떨어지거나 괴사",
    "새순이나 생장점이 멈추고 포기 전체로 확산",
    "하우스나 포장 전체에서 동시에 비슷한 증상 발생",
  ];

  // 9️⃣ 조치(캡 적용) 안내 문구
  const adjustment_note: string[] = [
    "사진과 답변만으로는 단정이 어려워, 확률이 과도하게 튀지 않도록 조정했습니다.",
    "바이러스 의심은 추가 확인 질문 전까지 보수적으로 반영했습니다.",
  ];

  const followup_message =
    `${farmerLabel()} 지금 단계에서는 ‘단정’보다 ‘확률’로 접근하겠습니다.\n` +
    `병해는 하루아침에 끝나지 않습니다.\n` +
    `2~3일 후 변한 모습으로 다시 올려주시면, 지금보다 훨씬 정확하게 좁혀드릴 수 있습니다.`;

  // 🔟 FINAL 반환
  return {
    farmer_summary,
    possible_causes,
    must_check,
    do_not,
    next_steps,
    need_119_if,
    adjustment_note,   // ✅ 캡 적용 설명
    followup_message,
  };
}

function stripEnglish(lines: string[]) {
  return lines.filter((l) => !/[a-zA-Z]/.test(l));
}


/** =========================
 *  POST handler (✅ export 스코프 정상)
 * ========================= */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const action = (normalizeText(form.get("action")) as "start" | "answer") || "start";

    const image = form.get("image") as File | null;
    if (!image) {
      return NextResponse.json({ ok: false, error: "이미지가 필요합니다." } satisfies ApiResponse, { status: 400 });
    }

    const crop = normalizeText(form.get("crop"));
    const region = normalizeText(form.get("region"));

    const historyRaw = normalizeText(form.get("history")) || "[]";
    const history = safeJsonParse<HistoryItem[]>(historyRaw, []);

  // answer 처리
if (action === "answer") {
  const qid = normalizeText(form.get("qid"));
  const ansRaw = normalizeText(form.get("answer"));

  if (!qid) {
    return NextResponse.json(
      { ok: false, error: "qid가 없습니다." } satisfies ApiResponse,
      { status: 400 }
    );
  }

  const parsedAns = safeJsonParse<any>(ansRaw, ansRaw);

  // 중복 질문 방지
  const already = history.some(
    (h) => h.role === "farmer" && (h as any).qid === qid
  );

  if (!already) {
    // 1️⃣ 농부 답변 저장
    history.push({
      role: "farmer",
      qid,
      answer: parsedAns,
      kind: Array.isArray(parsedAns) ? "CHOICE" : "FREE_TEXT",
    });

    // 2️⃣ FREE_TEXT → TEXT_SIGNAL / TEXT_INTENT
    if (typeof parsedAns === "string" && parsedAns.trim().length > 0) {
      const text = parsedAns.trim();

      // 🔥 TEXT_SIGNAL (병해 단서 증폭용)
      const signals = signalizeText(text);
      if (signals.length > 0) {
        history.push({
          role: "doctor",
          kind: "__TEXT_SIGNAL__",
          text: JSON.stringify(signals),
        });
      }

      // 🔥 TEXT_INTENT (다음 질문 방향 제어용)
      const intents = extractIntentFromFreeText(text);
      if (intents.length > 0) {
        history.push({
          role: "doctor",
          kind: "__TEXT_INTENT__",
          text: JSON.stringify({
            source_qid: qid,
            raw_text: text,
            intents,
            at: Date.now(),
          }),
        });
      }
    }
  }
}  

    // image → base64
    const buffer = Buffer.from(await image.arrayBuffer());
    const imageUrl = makeBase64DataUrl(buffer, image.type);

     // ===============================
// FIRST_VISION : 1회만 생성 + 타입 안전
// ===============================
let firstVision = history.find(
  (h): h is Extract<HistoryItem, { role: "doctor"; text: string }> =>
    h.role === "doctor" && h.kind === "__FIRST_VISION__"
);

if (!firstVision) {
  const first = await visionFirstRead(imageUrl, crop, region);

  const record: Extract<HistoryItem, { role: "doctor"; text: string }> = {
    role: "doctor",
    kind: "__FIRST_VISION__",
    text: JSON.stringify(first),
  };

  history.push(record);
  firstVision = record;
}

// 🔒 여기부터는 무조건 doctor + text 있음
const first = safeJsonParse<any>(firstVision.text, null);

if (!first) {
  return NextResponse.json(
    { ok: false, error: "FIRST_VISION 파싱 실패" } satisfies ApiResponse,
    { status: 500 }
  );
}  

    // 루트(primary) 보정
    const askedQids = buildAskedQids(history);
    const routeAnswer = (history.find((h) => h.role === "farmer" && (h as any).qid === "ROUTE_CONFIRM") as any)?.answer;

    let primary: PrimaryCategory = first.primary_category as PrimaryCategory;

    if (routeAnswer) {
      const s = Array.isArray(routeAnswer) ? routeAnswer.join(" ") : String(routeAnswer);
      if (s.includes("성장")) primary = "GROWTH";
      if (s.includes("병해") || s.includes("해충")) {
        primary = first.primary_category === "GROWTH" ? "DISEASE" : (first.primary_category as PrimaryCategory);
      }
    }

    // FINAL 판단
    const MIN_QUESTIONS = Number(process.env.VISION_MIN_QUESTIONS || 4);
    const finalize = shouldFinalize(askedQids, MIN_QUESTIONS);

    if (finalize) {
      const fin = buildFinal(history, first.crop_guess?.name || crop || "미상");

      const resp: ApiResponse = {
        ok: true,
        phase: "FINAL",
        primary_category: primary,
        crop_guess: first.crop_guess,
        observations: first.observations,
        ...fin,
      };

      return NextResponse.json(resp);
    }

    // 다음 질문 선택 (TEXT_SIGNAL 1회 개입)
    let nextQ = chooseNextQuestion(primary, askedQids, history);

      const textSignals: string[] = history
  .filter(
    (
      h
    ): h is Extract<HistoryItem, { role: "doctor"; text: string }> =>
      h.role === "doctor" &&
      (h.kind === "__TEXT_SIGNAL__" || h.kind === "__TEXT_INTENT__")
  )
  .flatMap((h) => {
    const parsed = safeJsonParse<any>(h.text, null);
    if (!parsed) return [];
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.intents)) return parsed.intents;
    return [];
  });

    if (textSignals.length > 0 && nextQ) {
      const priority = ["FRUIT_SYMPTOM", "FUNGAL_HINT", "PEST_HINT", "WATER_STRESS", "NUTRIENT_EXCESS", "NUTRIENT_DEF"];
      const picked = priority.find((p) => textSignals.includes(p));

      if (picked === "FRUIT_SYMPTOM" && !askedQids.includes("FRUIT_DETAIL")) {
        nextQ = {
          id: "FRUIT_DETAIL",
          kind: "CHOICE",
          text: "열매에 나타난 증상은 어떤 모습인가요?",
          choices: ["갈색 반점이나 썩음", "물러지거나 점액이 생김", "표면이 거칠어짐/코르크화", "구멍이 나거나 파임", "잘 모르겠습니다", "기타(직접 입력)"],
        };
      } else if (picked === "FUNGAL_HINT" && !askedQids.includes("FUNGAL_DETAIL")) {
        nextQ = {
          id: "FUNGAL_DETAIL",
          kind: "CHOICE",
          text: "곰팡이성 병해로 의심되는 이유가 있나요?",
          choices: ["비 온 뒤 심해짐", "습한 날에 빠르게 번짐", "반점 가장자리에 테두리", "이슬/결로가 많았음", "잘 모르겠습니다", "기타(직접 입력)"],
        };
      } else if (picked === "PEST_HINT" && !askedQids.includes("PEST_TRACE")) {
        nextQ = {
          id: "PEST_TRACE",
          kind: "CHOICE",
          text: "해충으로 의심되는 흔적이 보이나요?",
          choices: ["잎이나 열매에 끈적임", "작은 벌레가 보임", "구멍/긁힌 흔적", "검은 그을음", "잘 모르겠습니다", "기타(직접 입력)"],
        };
      } else if (picked === "WATER_STRESS" && primary === "GROWTH" && !askedQids.includes("G3_WATER_PATTERN")) {
        nextQ = Q_GROWTH_POOL.find((q) => q.id === "G3_WATER_PATTERN") || nextQ;
      } else if ((picked === "NUTRIENT_EXCESS" || picked === "NUTRIENT_DEF") && primary === "GROWTH" && !askedQids.includes("G5_FEED_RECENT")) {
        nextQ = Q_GROWTH_POOL.find((q) => q.id === "G5_FEED_RECENT") || nextQ;
      }
    }

    // 질문이 더 없으면 FINAL
    if (!nextQ) {
      const fin = buildFinal(history, first.crop_guess?.name || crop || "미상");

      const resp: ApiResponse = {
        ok: true,
        phase: "FINAL",
        primary_category: primary,
        crop_guess: first.crop_guess,
        observations: first.observations,
        ...fin,
      };

      return NextResponse.json(resp);
    }

    // QUESTION 응답
    const resp: ApiResponse = {
      ok: true,
      phase: "QUESTION",
      primary_category: primary,
      crop_guess: first.crop_guess,
      observations: first.observations,
      doctor_note: first.doctor_note,
      question: nextQ,
      progress: { asked: askedQids.length, target: MIN_QUESTIONS },
    };

    return NextResponse.json(resp);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "서버 오류" } satisfies ApiResponse, { status: 500 });
  }
}