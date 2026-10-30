// app/api/vision/route.ts

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { v4 as uuidv4 } from "uuid";
import { randomUUID } from "crypto";

// ✅ 구글시트 저장 함수
import { appendToSheet } from "../../../lib/googleSheets";

// ✅ 🔥 병해충 표준화 함수 (추가)
import { standardizeDiagnosis } from "../../../lib/standardizeDiagnosis";

// ✅ 진단 지침 v2 (2026-10-30)
import { GUARD_PROMPT_DIAGNOSIS_V2, PROMPT_VERSION } from "../../prompts/guard_prompt_diagnosis_v2";
// ✅ 근거 재판정 (전문가 상담 사례 + 날씨)
import { verifyWithEvidence } from "../../../lib/evidence/verify";

// ✅ 시험용 기기 — 이 device_id 로 들어온 진단은 사진·DB·시트에 저장하지 않음(운영 기록 오염 방지)
const TEST_DEVICE_ID = "claude-system-check";

// ✅ Edge 환경 방지
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // 2단계 판정까지 여유

// ✅ OpenAI 설정
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  timeout: 40_000, // 한 번 호출이 40초 넘으면 끊음 (멈춤 방지)
  maxRetries: 1,
});

// ✅ Firebase Admin SDK 초기화 (⚠️ 빌드 타임 실행 방지: 함수 안에서만 호출)
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function initFirebase() {
  const hasEnv =
    !!process.env.FIREBASE_PROJECT_ID &&
    !!process.env.FIREBASE_CLIENT_EMAIL &&
    !!process.env.FIREBASE_PRIVATE_KEY &&
    !!process.env.FIREBASE_STORAGE_BUCKET;

  if (!hasEnv) {
    throw new Error("Firebase environment variables are missing");
  }

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
      }),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
  }

  const db = getFirestore();
  const bucket = getStorage().bucket(process.env.FIREBASE_STORAGE_BUCKET);

  return { db, bucket };
}

// ✅ JSON 응답 도우미
function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

/* ===============================
   ✅ (추가) 결과 안전망: 프론트/시트가 절대 깨지지 않게 형태 강제
   - observations 3~8
   - possible_causes 2~4, name/why 빈값 금지, 확률 합 100 보정
   - actions doNow/doNot/mustCheck 최소 개수 보장
   - ✅ (추가) 해충 루트 오진 가드(벼멸구/노린재) 최소 개입
================================ */
function ensureArray<T>(v: any): T[] {
  return Array.isArray(v) ? v : [];
}

function ensureNonEmptyString(v: any, fallback: string) {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : fallback;
}

function clampInt(v: any, min: number, max: number, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.round(n);
  return Math.max(min, Math.min(max, i));
}

/** ✅ (추가) 해충/질병 혼합 방지 + 대표 오진 최소 가드 */
function applyMisdiagnosisGuards(input: any) {
  const out = { ...(input || {}) };

  const obsArr = ensureArray<string>(out.observations).filter((x) => typeof x === "string");
  const obsText = obsArr.join(" ");

  const causes = ensureArray<any>(out.possible_causes);
  const topName = typeof causes?.[0]?.name === "string" ? causes[0].name : "";
  const topWhy = typeof causes?.[0]?.why === "string" ? causes[0].why : "";

  // ✅ 해충/질병 혼합 방지 힌트(관찰/근거에 곤충 단서가 강하면 병명 단정 완화)
  const insectClue =
    /곤충|해충|벌레|성충|약충|유충|알|흡즙|천공|배설물|가해|노린재|멸구|총채|진딧물|나방|딱정벌레|응애/i.test(
      obsText + " " + topWhy
    );
  const diseaseClue =
    /병반|곰팡이|균사|수침|괴사|반점|무름|썩음|잿빛|흰가루|노균|역병|탄저|세균|바이러스/i.test(
      obsText + " " + topWhy
    );

  // 둘 다 강하게 섞여 있으면: final_judgement를 “추가 확인 필요”로 완화(크래시 방지용 최소 수정)
  if (insectClue && diseaseClue && typeof out.final_judgement === "string") {
    out.final_judgement = out.final_judgement.trim() ? out.final_judgement : "추가 확인 필요";
  }

  // ✅ 대표 오진 가드: 노린재 단서 강한데 top이 벼멸구면 교정
  const hasStinkBugClue = /노린재|방패|shield|pentatom/i.test(obsText + " " + topWhy);
  const hasPlanthopperClue = /멸구|planthopper|매미충|쐐기형|가늘고\s?긴\s?몸/i.test(
    obsText + " " + topWhy
  );

  if (topName.includes("벼멸구") && hasStinkBugClue && !hasPlanthopperClue && causes?.[0]) {
    causes[0].name = "노린재";
    causes[0].why =
      (topWhy ? topWhy + " / " : "") + "관찰 단서가 노린재(방패형 체형) 쪽에 더 가깝습니다.";
    out.possible_causes = causes;
    out.final_judgement = "노린재";
  }

  return out;
}

/** ✅ v3 (2026-10-30): "70% 방향 + 30% 다른 가능성"
 *  - 사진 한 장으로 단정하지 않음: 1순위 확률 최대 70%, 나머지 30%는 다른 가능성으로 열어 둠
 *  - 원인을 "방향"(물·온도 / 병 / 벌레 / 영양 / 약해 / 정상)으로 묶어 판단 — 같은 방향 후보의 확률을 합침
 *  - 방향 합 60% 이상 = "방향 뚜렷", 40~60% = "방향 추정", 그 밖 = "가능성 열어 둠"(상담 연결)
 *  - 뭉뚱그린 이름(영양 결핍·생리장해·환경 스트레스 등)은 후보에서 지움
 */
const V2_TYPES = ["병해", "해충", "생리장해", "약해", "불명"];
const VAGUE_NAME =
  /^(영양\s*(결핍|부족|불균형|과다)?|(일반\s*)?생리(적)?\s*(장해|문제|스트레스)|환경(적)?\s*(스트레스|요인|문제)|병해(충)?(\s*피해)?|곰팡이병|세균병|바이러스병|원인\s*미상.*|기타|일시적\s*스트레스|(일반적인\s*)?(생육|생장)\s*상태)$/;
const TOP_CAP = 70;

function isVagueName(name: string) {
  return VAGUE_NAME.test(String(name || "").replace(/\s+/g, " ").trim());
}

function directionOf(name: string): string {
  const n = String(name || "");
  if (/정상/.test(n)) return "정상";
  if (/약해|농약\s*피해|제초제/.test(n)) return "약해";
  if (/결핍|과다|영양|비료/.test(n)) return "영양";
  if (/나방|진딧물|응애|총채|벌레|노린재|멸구|굴파리|애벌레|해충|깍지|파리|선충|달팽이|민달팽이|거세미|담배나방|좀나방|잎벌레|매미충/.test(n)) return "벌레";
  if (/건조|수분|가뭄|과습|침수|일소|햇|고온|저온|냉해|동해|서리|열과|염류|물리적|기계적|바람|우박|이데마|수종/.test(n)) return "물·온도";
  if (/병|곰팡이|역병|탄저|무름|흰가루|노균|바이러스|반점|무늬|마름|썩음|궤양|부패|균/.test(n)) return "병";
  return "기타";
}
const SAFE_DEFAULT: Record<string, string[]> = {
  "물·온도": ["손가락 한 마디 깊이로 흙을 만져 마름·질척임을 확인하세요.", "원인 확인 전에는 약을 치지 마세요.", "3일 뒤 같은 자리를 다시 찍어 비교해 주세요."],
  병: ["병든 잎·열매는 따서 밭 밖으로 치우세요.", "잎이 젖어 있는 시간을 줄이도록 환기·물주기를 조절하세요.", "3일 뒤 같은 자리를 다시 찍어 번지는지 확인해 주세요."],
  벌레: ["잎 뒷면과 새순을 돋보기로 확인해 벌레·알을 찾아보세요.", "벌레가 보이면 그 포기만 먼저 따로 표시해 두세요.", "3일 뒤 피해가 늘었는지 다시 찍어 주세요."],
  영양: ["비료를 더 주기 전에 물 상태와 뿌리부터 확인하세요.", "같은 비료·영양제를 반복해서 주지 마세요.", "새잎과 아랫잎 중 어디서 시작됐는지 찍어 주세요."],
  약해: ["최근 2주 친 약 이름과 농도를 확인해 주세요.", "같은 약을 다시 치지 마세요.", "새로 나오는 잎이 정상인지 1주 뒤 확인해 주세요."],
  정상: ["지금은 특별한 조치가 필요 없어 보입니다.", "변화가 생기면 같은 자리를 다시 찍어 주세요."],
  기타: ["병든 부위는 따서 밭 밖으로 치우세요.", "원인 확인 전에는 같은 약을 반복해서 치지 마세요.", "포기 전체 사진을 한 장 더 찍어 주세요."],
};

function applyV2Rules(out: any) {
  const all = ensureArray<any>(out.possible_causes);
  let causes = all.filter((c) => !isVagueName(c?.name));
  out.vague_removed = all.filter((c) => isVagueName(c?.name)).map((c) => c?.name);

  // 확률 다시 맞추기 (합 100) + 1순위 상한 70%
  const tot = causes.reduce((a, c) => a + (Number(c?.probability) || 0), 0) || 1;
  causes = causes
    .map((c) => ({ ...c, probability: Math.round(((Number(c?.probability) || 0) / tot) * 100) }))
    .sort((a, b) => b.probability - a.probability);
  if (causes.length && causes[0].probability > TOP_CAP) {
    const extra = causes[0].probability - TOP_CAP;
    causes[0].probability = TOP_CAP;
    const rest = causes.slice(1);
    const restTot = rest.reduce((a, c) => a + c.probability, 0);
    if (rest.length) rest.forEach((c) => (c.probability += restTot ? Math.round((c.probability / restTot) * extra) : Math.round(extra / rest.length)));
    else causes.push({ name: "다른 원인 가능성", probability: 100 - TOP_CAP, why: "사진 한 장으로는 다른 원인을 배제할 수 없습니다.", how_to_tell: "포기 전체와 잎 뒷면 사진을 더 찍어 확인해 주세요." });
  }
  causes.forEach((c) => {
    c.direction = directionOf(c.name);
    c.how_to_tell = typeof c.how_to_tell === "string" ? c.how_to_tell.trim() : "";
  });
  out.possible_causes = causes;

  // 방향별 확률 합
  const share: Record<string, number> = {};
  for (const c of causes) share[c.direction] = (share[c.direction] || 0) + c.probability;
  const dirs = Object.entries(share).sort((a, b) => b[1] - a[1]);
  const [dir, dirP] = dirs[0] || ["기타", 0];
  const top = causes.find((c) => c.direction === dir) || causes[0];
  out.direction = dir;
  out.direction_share = share;

  out.judgement_type = V2_TYPES.includes(out.judgement_type) ? out.judgement_type : "불명";
  out.confidence = Math.min(TOP_CAP, clampInt(out.confidence, 0, 100, top?.probability || 0));
  out.ask_questions = ensureArray<string>(out.ask_questions).map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean).slice(0, 5);
  out.safe_actions = ensureArray<string>(out.safe_actions).map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean).slice(0, 4);
  if (out.safe_actions.length < 2) out.safe_actions = SAFE_DEFAULT[dir] || SAFE_DEFAULT["기타"];
  out.photo_request = typeof out.photo_request === "string" ? out.photo_request.trim() : "";
  out.ai_top_guess = top?.name || "";

  if (out.status === "needs_more_photos") {
    out.final_judgement = "사진 다시 필요";
    if (!out.photo_request) out.photo_request = "증상 부위를 가까이(20~30cm), 그리고 포기 전체를 한 장 더 밝은 곳에서 찍어 주세요.";
  } else if (out.weather_conflict) {
    out.status = "open";
    out.final_judgement = "사진만 보면 날씨 탓 같지만 최근 날씨와 맞지 않습니다 — 병·벌레 가능성을 확인해 보세요";
  } else if (dir === "정상" && dirP >= 60) {
    out.status = "direction";
    out.final_judgement = "정상으로 보입니다";
  } else if (dirP >= 60) {
    out.status = "direction";
    out.final_judgement = `${dir} 쪽 문제로 보입니다 — ${top?.name} 가능성이 가장 높음`;
  } else if (dirP >= 40) {
    out.status = "likely";
    out.final_judgement = `${dir} 쪽일 가능성이 있습니다 — ${top?.name} 먼저 확인`;
  } else {
    out.status = "open";
    out.final_judgement = "여러 가능성이 비슷합니다 — 아래 구별법으로 확인하거나 상담을 받아 보세요";
  }
  if (out.status !== "needs_more_photos" && !out.ask_questions.length) {
    out.ask_questions = ["최근 1주 물 주기·비는 어땠나요?", "밭 전체에 나타났나요, 일부 포기만인가요?", "최근 2주 안에 약이나 영양제를 쳤나요?"];
  }
  out.prompt_version = PROMPT_VERSION;
  return out;
}

function enforceDiagnosisShape(input: any) {
  // ✅ (추가) 오진 가드 먼저 적용(최소 개입) → 그 다음 형태 보정
  let out: any = applyMisdiagnosisGuards(input);

  // observations
  out.observations = ensureArray<string>(out.observations)
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean);

  while (out.observations.length < 3) {
    out.observations.push("사진에서 확인되는 특징이 제한적이라 추가 확인이 필요합니다.");
  }
  if (out.observations.length > 8) out.observations = out.observations.slice(0, 8);

  // possible_causes
  let causes = ensureArray<any>(out.possible_causes).map((c) => ({
    name: ensureNonEmptyString(c?.name, "원인 미상"),
    probability: clampInt(c?.probability, 1, 99, 50),
    why: ensureNonEmptyString(
      c?.why,
      "사진에서 보이는 단서만으로는 확정이 어려워 추가 확인이 필요합니다."
    ),
    how_to_tell: typeof c?.how_to_tell === "string" ? c.how_to_tell : "",
  }));

  while (causes.length < 2) {
    causes.push({
      name: "원인 미상",
      probability: 50,
      why: "사진에서 보이는 단서만으로는 확정이 어려워 추가 확인이 필요합니다.",
      how_to_tell: "",
    });
  }
  if (causes.length > 4) causes = causes.slice(0, 4);

  // 확률 합 100 맞추기(마지막 원소로 보정)
  const sum = causes.reduce((a, c) => a + (Number(c.probability) || 0), 0);
  if (sum !== 100) {
    const safe = sum <= 0 ? 1 : sum;
    const scaled = causes.map((c) => ({
      ...c,
      probability: clampInt((c.probability / safe) * 100, 1, 99, c.probability),
    }));
    const s2 = scaled.reduce((a, c) => a + c.probability, 0);
    scaled[scaled.length - 1].probability = clampInt(
      scaled[scaled.length - 1].probability + (100 - s2),
      1,
      99,
      scaled[scaled.length - 1].probability
    );
    out.possible_causes = scaled;
  } else {
    out.possible_causes = causes;
  }

  // final_judgement
  out.final_judgement = ensureNonEmptyString(
    out.final_judgement,
    out.possible_causes?.[0]?.name || "원인 미상"
  );

  // actions
  const actions = out.actions || {};
  const doNow = ensureArray<string>(actions.doNow)
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean);
  const doNot = ensureArray<string>(actions.doNot)
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean);
  const mustCheck = ensureArray<string>(actions.mustCheck)
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean);

  while (doNow.length < 2) doNow.push("증상이 보이는 부위를 우선 분리하고 확산을 막아주세요.");
  while (doNot.length < 1) doNot.push("원인 확정 전 동일 약제를 반복 살포하지 마세요.");
  while (mustCheck.length < 2)
    mustCheck.push("잎 뒷면/줄기/뿌리 쪽에도 같은 증상이 있는지 확인해주세요.");

  out.actions = {
    doNow: doNow.slice(0, 5),
    doNot: doNot.slice(0, 3),
    mustCheck: mustCheck.slice(0, 5),
  };

  // disclaimer / emergency_form_url
  out.disclaimer = ensureNonEmptyString(
    out.disclaimer,
    "이 결과는 참고용 AI 분석이며, 최종 판단과 책임은 농업인에게 있습니다."
  );

  out.emergency_form_url = ensureNonEmptyString(
    out.emergency_form_url,
    "https://docs.google.com/forms/d/e/1FAIpQLSdKgcwl_B-10yU0gi4oareM4iajMPND6JtGIZEwjbwPbnQBEg/viewform"
  );

  out.ok = !!out.ok;

  // ✅ v2 규칙 (형태 보정 뒤 마지막에)
  return applyV2Rules(out);
}

// ✅ POST 요청 처리
export async function POST(req: Request) {
  try {
    // ✅ (중요) Firebase는 요청 시점에만 초기화 (빌드 타임 크래시 방지)
    const { db, bucket } = initFirebase();

    const form = await req.formData();

    const image = form.get("image") as File | null;
    const crop = (form.get("crop") as string) || "미상";
    const province = (form.get("province") as string) || "";
    const city = (form.get("city") as string) || "";
    const device_id = ((form.get("device_id") as string) || "").trim();

    if (!image) return json({ ok: false, error: "사진이 없습니다." }, 400);

    // 진단 시점 (시험 기기만 과거 날짜 지정 가능 — 지난 진단을 그날 날씨로 재시험)
    const observedRaw = (form.get("observed_at") as string) || "";
    const observedAt =
      device_id === TEST_DEVICE_ID && observedRaw && !isNaN(Date.parse(observedRaw)) ? new Date(observedRaw) : new Date();

    // ✅ (추가) 첫 방문 여부 판정
    let isFirstDiagnosis = true;

    if (device_id) {
      const snap = await db
        .collection("diagnoses")
        .where("device_id", "==", device_id)
        .limit(1)
        .get();

      if (!snap.empty) isFirstDiagnosis = false;
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    const mime = image.type || "image/jpeg";
    const base64 = buffer.toString("base64");
    const imageUrl = `data:${mime};base64,${base64}`;

    // ✅ GPT 프롬프트
    const system = `
당신은 작물 병해충/생리장해를 진단하는 전문가입니다.
응답은 반드시 아래 JSON 형식만 출력합니다(설명문, 마크다운, 코드블록 금지).

[중요 규칙]
- probability는 1~99 사이 정수
- possible_causes는 2~4개
- 확률은 증거 강도에 따라 유동 배분
- 합계는 반드시 100
- 고정 70/30 패턴 금지
- why는 사진 기반 근거 1~2문장

[1차 분기 규칙 – 절대 우선]
- 먼저 사진에 ‘개별 곤충 몸체(등판/머리/다리/더듬이)’가 명확히 보이는지 판단한다.
- 개별 곤충이 명확히 보이면 → 해충 루트로만 분석한다(질병/생리장해 원인 금지).
- 개별 곤충이 보이지 않으면 → 질병/생리장해 루트로만 분석한다(해충 원인 금지).
- 두 루트를 동시에 섞지 말 것.

[해충 루트 규칙 – 작물 편향 차단]
- 작물 정보(예: 벼)는 ‘보조 정보’일 뿐이며, 해충 이름을 먼저 고정하면 안 된다.
- 반드시 “형태(체형)”를 우선 분류한 뒤 후보를 좁힌다.
- 형태가 맞지 않으면 작물 대표 해충이라도 후보에서 제외한다.
  (예: 방패형/넓은 등판/방패 모양 → 노린재 계열 가능성↑, 벼멸구는 형태가 다르면 제외)

[질병 루트 규칙]
- 병반(색/경계/확산/곰팡이·수침·괴사 특징)을 우선 관찰한다.
- 흡즙/천공/배설물/가해 흔적 등 곤충 증거가 없으면 해충 원인은 제외한다.

[JSON 스키마]
{
  "ok": true,
  "crop": "작물명",
  "region": "시/군 또는 지역",
  "observations": [],
  "possible_causes": [],
  "final_judgement": "",
  "judgement_type": "병해|해충|생리장해|약해|불명",
  "confidence": 0,
  "status": "confident|needs_more_photos",
  "ask_questions": [],
  "safe_actions": [],
  "photo_request": "",
  "actions": {},
  "disclaimer": "",
  "emergency_form_url": ""
}

[출력 검증 – 스스로 점검 후 출력]
- possible_causes의 name은 ‘서로 다른 원인’이어야 한다(동의어/별칭 중복 금지).
- 해충 루트에서 “벼멸구”를 출력하려면, why에 ‘형태 단서’를 반드시 포함해야 한다.
  (예: 체형/날개/다리/몸통 형태 중 1개 이상 구체적으로 언급)
- 형태 단서 없이 작물명만으로 특정 해충을 단정하면 안 된다.

[추가 강제]
- 확률 합이 100이 아니면 스스로 수정
- probability는 반드시 정수

[출력 강제 규칙 - 누락/빈값 방지]
- observations는 반드시 배열이며, 길이는 3~8개. 빈 배열 금지.
- possible_causes는 반드시 배열이며, 길이는 2~4개. 빈 배열 금지.
- possible_causes의 각 원소는 반드시 다음 3개 키를 모두 포함:
  - name: 비어있지 않은 문자열(최소 2글자)
  - probability: 1~99 정수
  - why: 비어있지 않은 문자열(최소 1문장)
- actions는 반드시 객체이며, 아래 3개 키를 모두 포함하고 각 값은 반드시 배열:
  - doNow: 2~5개 (빈 배열 금지)
  - doNot: 1~3개 (빈 배열 금지)
  - mustCheck: 2~5개 (빈 배열 금지)
- final_judgement는 비어있지 않은 문자열(최소 2글자)이며, possible_causes[0].name과 동일하거나 더 구체화된 표현이어야 함. 단, needs_more_photos면 "사진 다시 필요". (확정/추정/전문가 확인 표시는 서버가 붙인다)
- disclaimer와 emergency_form_url은 반드시 포함하며, 비어있지 않은 문자열이어야 함.
- 어떤 필드도 null/undefined로 출력하지 말 것. 문자열은 "" 금지(필수 필드).
- “확률 합계 100” 규칙을 만족하지 않으면, 출력 전에 스스로 수정하여 100으로 맞춘 후 출력.

[금지]
- 마크다운/코드블록/추가 설명 문장/주석/전후 텍스트 절대 금지.
- JSON 밖의 어떤 문자도 출력 금지.

${GUARD_PROMPT_DIAGNOSIS_V2}
`.trim();

    const user = `
작물: ${crop}
지역: ${province} ${city}

아래 이미지를 보고 위 JSON 형식에 맞춰 진단 결과를 작성해주세요.
`.trim();

    // ✅ GPT 호출
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0,
      seed: 7, // 같은 사진 → 같은 답 (흔들림 줄이기)
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: user },
            { type: "image_url", image_url: { url: imageUrl } },
          ] as any,
        },
      ],
    });

    const output = response.choices[0]?.message?.content || "{}";
    const firstPass = JSON.parse(output);

    // ✅ 2단계: 전문가 사례·사진·날씨로 다시 판정 (실패하면 1차 판정 그대로)
    let rawData = firstPass;
    let evidence: any = null;
    if (process.env.EVIDENCE_MODE !== "off" && firstPass?.status !== "needs_more_photos") {
      try {
        const v = await verifyWithEvidence({
          openai, system, imageUrl, crop, region: `${province} ${city}`.trim(), at: observedAt, first: firstPass,
        });
        if (v) { rawData = v.result; evidence = v.evidence; }
      } catch (e: any) {
        console.error("⚠️ 근거 재판정 실패(1차 판정 사용):", e?.message || e);
      }
    }

    // ✅ 🔥 표준화 강제 적용 (핵심 추가)
    // - 표준화에서 예외가 나도 전체 진단/저장이 죽지 않게 안전망 추가
    const regionStr = `${province} ${city}`.trim();
    let data = rawData;

    try {
      data = standardizeDiagnosis({
        ...rawData,
        crop,
        region: regionStr,
      });
    } catch (normErr: any) {
      console.error("❌ standardizeDiagnosis 실패(원본으로 진행):", normErr?.message || normErr);
      // 원본으로 계속 진행하되, 최소한 crop/region은 맞춰줌
      data = {
        ...rawData,
        crop,
        region: regionStr,
      };
    }

    // ✅ (추가) 최종 형태 보정: 프론트/시트 안전
    data = enforceDiagnosisShape(data);
    data.evidence = evidence; // 어떤 근거로 판정했는지 (사례 번호·날씨)
    data.first_pass = (firstPass?.possible_causes || []).slice(0, 3).map((c: any) => `${c?.name} ${c?.probability}%`).join(" / ");

    // ✅ 시험 기기: 저장 없이 결과만 돌려줌 (운영 DB·시트·앱시트에 안 남음)
    if (device_id === TEST_DEVICE_ID) {
      return json({ ...data, test_mode: true });
    }

    // ✅ 이미지 Storage 저장 (✅ 토큰 심기 + 열리는 URL 생성)

    // 확장자 안전 처리 (jpeg → jpg로 정리)
    const ext = (mime.split("/")[1] || "jpg").replace("jpeg", "jpg");

    // ✅ 파일명에 시간 넣기 (정렬 최강): 20260124_043501_9f3a....jpg
    const stamp = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace("T", "_")
      .slice(0, 15); // YYYYMMDD_HHMMSS

    const filename = `${stamp}_${uuidv4()}.${ext}`;
    const objectPath = `uploads/${filename}`;

    // ✅ 다운로드 토큰 생성
    const downloadToken = randomUUID();

    // ✅ 업로드 + 토큰 심기 (핵심)
    await bucket.file(objectPath).save(buffer, {
      contentType: mime,
      resumable: false,
      metadata: {
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
        },
      },
    });

    // ✅ “무조건 열리는” 다운로드 URL
    const imageStorageUrl =
      `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/` +
      `${encodeURIComponent(objectPath)}?alt=media&token=${downloadToken}`;

    // ✅ Firestore/Sheet에 저장할 imagePath는 "uploads/..." 형태로!

    // ✅ Firestore 저장
    const createdAt = new Date();

    const docRef = await db.collection("diagnoses").add({
      createdAt,
      crop,
      province,
      city,
      region: regionStr,
      result: data, // ✅ 표준화된 결과(또는 raw fallback) + 최종 보정
      imagePath: objectPath,
      imageUrl: imageStorageUrl,
      device_id,
      // 🔽 여기 추가
      first_diagnosis_used: !isFirstDiagnosis,
    });

    console.log("✅ Firestore 저장 완료:", docRef.id);

    // ✅ Google Sheet 저장
    try {
      const obs0 = data?.observations?.[0] ?? "";
      const obs1 = data?.observations?.[1] ?? "";
      const c1 = data?.possible_causes?.[0];
      const c2 = data?.possible_causes?.[1];

      const sheetRow = {
        diagnosis_id: docRef.id,
        createdAt: createdAt.toISOString(),

        crop,
        province,
        city,
        location: regionStr,

        ok: !!data?.ok,

        obs_0: obs0,
        obs_1: obs1,

        cause1_name: c1?.name ?? "",
        cause1_prob: c1?.probability ?? "",
        cause1_why: c1?.why ?? "",

        cause2_name: c2?.name ?? "",
        cause2_prob: c2?.probability ?? "",
        cause2_why: c2?.why ?? "",

        imagePath: objectPath,
        imageUrl: imageStorageUrl,

        device_id: device_id || "",

        // ✅ 여기만 수정: 첫/재방문 저장
        is_repeat: device_id ? (isFirstDiagnosis ? "첫 방문" : "재방문") : "device_id 없음",

        followup_count: "",
        admin_note: "",
        recommendedForSheet: "",
      };

      console.log("🧾 Sheet row payload:", sheetRow);
      await appendToSheet(sheetRow);
      console.log("✅ Google Sheet 저장 완료:", docRef.id);
    } catch (sheetErr: any) {
      console.error("❌ Google Sheet 저장 실패:", sheetErr?.message || sheetErr);
    }

    return json({ ...data, imageUrl: imageStorageUrl });
  } catch (e: any) {
    console.error("❌ Vision API 오류:", e);
    return json({ ok: false, error: e?.message || "서버 오류 발생" }, 500);
  }
}