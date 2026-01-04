// app/api/vision/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { v4 as uuidv4 } from "uuid";

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// ✅ Firebase 초기화 (1회만)
import { initializeApp, cert, getApps } from 'firebase-admin/app';

if (!getApps().length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'); // ← 핵심

  console.log('🔐 projectId:', process.env.FIREBASE_PROJECT_ID);
  console.log('🔐 clientEmail:', process.env.FIREBASE_CLIENT_EMAIL);
  console.log('🔐 privateKey (starts with):', privateKey?.slice(0, 30));

  console.log('✅ Parsed key lines:', privateKey?.split('\n').length);
  console.log('✅ Parsed key preview:\n', privateKey?.slice(0, 100));
  console.log('📦 bucket name:', process.env.FIREBASE_STORAGE_BUCKET)
  console.log("✅ storageBucket:", process.env.FIREBASE_STORAGE_BUCKET);
  console.log("🔥 FIREBASE_STORAGE_BUCKET = ", process.env.FIREBASE_STORAGE_BUCKET);
  console.log("📦 버킷 이름 확인:", process.env.FIREBASE_STORAGE_BUCKET);
  console.log("🔥 storageBucket =", process.env.FIREBASE_STORAGE_BUCKET);
  

  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}
const db = getFirestore();
const bucket = getStorage().bucket(process.env.FIREBASE_STORAGE_BUCKET);

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();

    const image = form.get("image") as File | null;
    const crop = (form.get("crop") as string) || "미상";
    const province = (form.get("province") as string) || "";
    const city = (form.get("city") as string) || "";

    if (!image) return json({ ok: false, error: "사진이 없습니다." }, 400);

    // ✅ 이미지 → Buffer → base64
    const buffer = Buffer.from(await image.arrayBuffer());
    const mime = image.type || "image/jpeg";
    const base64 = buffer.toString("base64");
    const imageUrl = `data:${mime};base64,${base64}`;

    // ✅ GPT 프롬프트
    const system = `
당신은 작물 병해충, 생리장해, 영양 문제를 진단하는 식물 병리 전문가입니다.
사진으로 진단을 요청한 사람은 농민입니다.

응답은 반드시 아래 JSON 형식으로만 출력하세요.  
다른 설명, 코드 블럭, 여는 말/닫는 말은 포함하지 마세요.

📌 응답 형식:
{
  "ok": true,
  "crop": "작물 이름",
  "region": "도시 또는 시/군 정보",
  "observations": ["사진에서 보이는 증상 2~4개"],
  "possible_causes": [
    {
      "name": "질병 또는 해충 이름",
      "probability": 70,
      "why": "왜 그렇게 판단했는지 설명"
    },
    {
      "name": "다른 가능성",
      "probability": 30,
      "why": "그럴 가능성도 있는 이유"
    }
  ],
  "final_judgement": "가장 가능성 높은 문제 이름",
  "actions": {
    "doNow": ["지금 해야 할 일 2~3개"],
    "doNot": ["하지 말아야 할 일 1~2개"],
    "mustCheck": ["확인해볼 사항들 (흙 상태, 주변 작물 등)"]
  },
  "disclaimer": "이 결과는 참고용 AI 분석이며, 최종 판단과 책임은 농업인에게 있습니다.",
  "emergency_form_url": "https://docs.google.com/forms/d/e/1FAIpQLSdKgcwl_B-10yU0gi4oareM4iajMPND6JtGIZEwjbwPbnQBEg/viewform"
}
※ 확률은 반드시 총합 100%로 맞춰주세요.
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
      metadata: {
        contentType: mime,
      },
    });
    const imageStorageUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    // ✅ Firestore에 진단 정보 저장
    const docRef = await db.collection("diagnoses").add({
      createdAt: new Date(),
      crop,
      province,
      city,
      region: `${province} ${city}`,
      result: data,
      imagePath: fileName,
      imageUrl: imageStorageUrl,
    });

    console.log("✅ Firestore 저장 완료:", docRef.id);

    // ✅ 결과 반환
    return json({ ...data, imageUrl: imageStorageUrl });

  } catch (e: any) {
    console.error("❌ Vision API 오류:", e);
    return json({ ok: false, error: e?.message || "서버 오류 발생" }, 500);
  }
}
