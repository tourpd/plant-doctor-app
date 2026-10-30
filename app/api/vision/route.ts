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

// ✅ 시험용 기기 — 이 device_id 로 들어온 진단은 사진·DB·시트에 저장하지 않음(운영 기록 오염 방지)
const TEST_DEVICE_ID = "claude-system-check";

// ✅ Edge 환경 방지
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ✅ OpenAI 설정
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
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

/** ✅ v2.1: 판정 단계를 서버가 정함 (AI가 규칙을 어겨도 여기서 바로잡음)
 *  - confident(확정): 1순위 65% 이상, 2순위와 25%p 이상 차이
 *  - likely(추정): 1순위 40% 이상, 2순위와 10%p 이상 차이 → "OOO (추정)" + 확인 질문
 *  - uncertain(전문가 확인 필요): 그 밖 → 상담 연결
 *  - 뭉뚱그린 이름(영양 결핍·생리장해·환경 스트레스 등)은 후보에서 지움
 */
const V2_TYPES = ["병해", "해충", "생리장해", "약해", "불명"];
const UNCERTAIN_LABEL = "전문가 확인 필요";
const VAGUE_NAME =
  /^(영양\s*(결핍|부족|불균형|과다)?|(일반\s*)?생리(적)?\s*(장해|문제|스트레스)|환경(적)?\s*(스트레스|요인|문제)|병해(충)?(\s*피해)?|곰팡이병|세균병|바이러스병|원인\s*미상.*|기타)$/;

function isVagueName(name: string) {
  return VAGUE_NAME.test(String(name || "").replace(/\s+/g, " ").trim());
}

function applyV2Rules(out: any) {
  const all = ensureArray<any>(out.possible_causes);
  const specific = all.filter((c) => !isVagueName(c?.name));
  out.vague_removed = all.filter((c) => isVagueName(c?.name)).map((c) => c?.name);
  out.possible_causes = specific;

  const p1 = Number(specific?.[0]?.probability) || 0;
  const p2 = Number(specific?.[1]?.probability) || 0;
  const gap = p1 - p2;

  out.judgement_type = V2_TYPES.includes(out.judgement_type) ? out.judgement_type : "불명";
  out.confidence = clampInt(out.confidence, 0, 100, p1);
  out.ask_questions = ensureArray<string>(out.ask_questions)
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean)
    .slice(0, 5);
  out.photo_request = typeof out.photo_request === "string" ? out.photo_request.trim() : "";

  const top = specific?.[0]?.name || "";
  out.ai_top_guess = top;

  if (out.status === "needs_more_photos") {
    out.final_judgement = "사진 다시 필요";
    out.judgement_type = "불명";
    if (!out.photo_request) {
      out.photo_request = "증상 부위를 가까이(20~30cm), 그리고 포기 전체를 한 장 더 밝은 곳에서 찍어 주세요.";
    }
  } else if (top && p1 >= 65 && gap >= 25) {
    out.status = "confident";
    out.final_judgement = top;
  } else if (top && p1 >= 40 && gap >= 10) {
    out.status = "likely";
    out.final_judgement = `${top} (추정)`;
    if (!out.ask_questions.length) {
      out.ask_questions = ["최근 1주 물 주기·비는 어땠나요?", "밭 전체에 나타났나요, 일부만인가요?"];
    }
  } else {
    out.status = "uncertain";
    out.final_judgement = UNCERTAIN_LABEL;
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
  }));

  while (causes.length < 2) {
    causes.push({
      name: "원인 미상",
      probability: 50,
      why: "사진에서 보이는 단서만으로는 확정이 어려워 추가 확인이 필요합니다.",
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
      temperature: 0.3,
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
    const rawData = JSON.parse(output);

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