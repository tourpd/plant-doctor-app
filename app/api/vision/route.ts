// app/api/vision/route.ts

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { v4 as uuidv4 } from "uuid";

// ✅ 구글시트 저장 함수 (추가)
import { appendToSheet } from "../../../lib/googleSheets";

// ✅ Edge 환경 방지
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ✅ OpenAI 설정
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// ✅ Firebase Admin SDK 초기화
import { initializeApp, cert, getApps } from "firebase-admin/app";

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

const db = getFirestore();
const bucket = getStorage().bucket(process.env.FIREBASE_STORAGE_BUCKET);

// ✅ JSON 응답 도우미
function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

// ✅ POST 요청 처리
export async function POST(req: Request) {
  try {
    const form = await req.formData();

    const image = form.get("image") as File | null;
    const crop = (form.get("crop") as string) || "미상";
    const province = (form.get("province") as string) || "";
    const city = (form.get("city") as string) || "";
    const device_id = (form.get("device_id") as string) || ""; // ✅ (추가) 기기 추적용

    if (!image) return json({ ok: false, error: "사진이 없습니다." }, 400);

    const buffer = Buffer.from(await image.arrayBuffer());
    const mime = image.type || "image/jpeg";
    const base64 = buffer.toString("base64");
    const imageUrl = `data:${mime};base64,${base64}`;

    // ✅ GPT 프롬프트 구성
    const system = `
    당신은 작물 병해충/생리장해를 진단하는 전문가입니다.
응답은 반드시 아래 JSON 형식만 출력합니다(설명문, 마크다운, 코드블록 금지).

[중요 규칙]
- probability는 1~99 사이 정수
- possible_causes는 2~4개
- 확률은 사진/입력 정보의 "증거 강도"에 따라 유동적으로 배분
- 합계는 반드시 100
- 상위 1개가 확실하면 80~95까지 가능
- 애매하면 40~60대로 분산 + 원인 3~4개로 확장
- 절대 70/30 같은 고정 패턴을 반복하지 말 것
- why는 "사진에서 보이는 구체적 단서" 중심으로 1~2문장

[JSON 스키마]
{
  "ok": true,
  "crop": "작물명",
  "region": "시/군 또는 지역",
  "observations": ["사진에서 보이는 관찰 3~8줄"],
  "possible_causes": [
    { "name": "원인1", "probability": 0, "why": "근거" },
    { "name": "원인2", "probability": 0, "why": "근거" }
  ],
  "final_judgement": "가장 가능성 높은 최종 판단(원인1과 동일하거나 더 구체화)",
  "actions": {
    "doNow": ["지금 해야 할 일 2~5개"],
    "doNot": ["하지 말아야 할 것 1~3개"],
    "mustCheck": ["반드시 확인할 사항 2~5개"]
  },
  "disclaimer": "이 결과는 참고용 AI 분석이며, 최종 판단과 책임은 농업인에게 있습니다.",
  "emergency_form_url": "https://docs.google.com/forms/d/e/1FAIpQLSdKgcwl_B-10yU0gi4oareM4iajMPND6JtGIZEwjbwPbnQBEg/viewform"
}

[추가 강제]
- possible_causes 확률 합이 100이 아니면 스스로 수정해서 100으로 맞춘 뒤 출력
- probability는 반드시 정수로 출력
`.trim();

    const user = `
작물: ${crop}
지역: ${province} ${city}

아래 이미지를 보고 위 JSON 형식에 맞춰 진단 결과를 작성해주세요.  
내용은 반드시 농민이 이해하기 쉬운 쉬운 말로 써 주세요.
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
    const data = JSON.parse(output);

    // ✅ 이미지 Storage 저장
    const fileName = `uploads/${uuidv4()}.${mime.split("/")[1]}`;
    await bucket.file(fileName).save(buffer, {
      metadata: { contentType: mime },
    });

    const imageStorageUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    // ✅ Firestore 저장
    const createdAt = new Date(); // ✅ (추가) 시트/DB 공통으로 쓰기
    const regionStr = `${province} ${city}`.trim();

    const docRef = await db.collection("diagnoses").add({
      createdAt,
      crop,
      province,
      city,
      region: regionStr,
      result: data,
      imagePath: fileName,
      imageUrl: imageStorageUrl,
      device_id,
    });

    console.log("✅ Firestore 저장 완료:", docRef.id);

    // ✅ ✅ ✅ 구글시트 저장 (추가) : 진단 1회 = 시트 1행
    // - 기존 시트 헤더(컬럼명)과 키가 100% 동일해야 함
    // - doNow/doNot은 지금 단계에서 비워도 OK (요청 반영)
    // ✅ ✅ ✅ 구글시트 저장 (100% 헤더 일치 버전)
// ✅ ✅ ✅ 구글시트 저장 (디버그 로그 포함)
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

    imagePath: fileName,
    imageUrl: imageStorageUrl,

    device_id: device_id || "",

    is_repeat: "첫 방문",
    followup_count: "",
    admin_note: "",
    recommendedForSheet: "",
  };

  // ⭐️ payload 확인 로그
  console.log("🧾 Sheet row payload:", sheetRow);

  // ⭐️ 실제 저장
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