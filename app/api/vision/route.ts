// app/api/vision/route.ts
// @ts-nocheck
import { NextResponse } from "next/server";
import OpenAI from "openai";

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { getFirestore } from "firebase-admin/firestore";

export const runtime = "nodejs";

/* ===============================
   Firebase Admin
================================ */
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

const bucket = getStorage().bucket();
const db = getFirestore();

/* ===============================
   OpenAI
================================ */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/* ===============================
   🔥 유사사진 DB (실데이터만)
================================ */
const CASE_DB = {
  "고추_탄저병": {
    summary: "고추 탄저병 초기 증상과 매우 유사합니다.",
    similarImages: [
      "https://real.katsv.kr/chili/anthracnose/1.jpg",
      "https://real.katsv.kr/chili/anthracnose/2.jpg",
      "https://real.katsv.kr/chili/anthracnose/3.jpg",
    ],
    contrastImages: [
      "https://real.katsv.kr/chili/healthy/leaf.jpg",
    ],
    actions: {
      doNow: [
        "병든 잎과 과실을 다른 포기와 접촉되지 않게 제거",
        "관수 시 잎에 물이 닿지 않도록 관리",
      ],
      doNot: [
        "질소·요소 계열 비료 추가 투입",
        "같은 약제를 연속 살포",
      ],
      mustCheck: [
        "비 온 뒤 확산 여부",
        "옆 포기 동일 증상 발생 여부",
      ],
    },
    katsv:
      "https://www.youtube.com/@한국농수산TV/search?query=고추+탄저병",
  },

  "고추_바이러스": {
    summary: "고추 바이러스 증상과 매우 유사합니다.",
    similarImages: [
      "https://real.katsv.kr/chili/virus/1.jpg",
      "https://real.katsv.kr/chili/virus/2.jpg",
      "https://real.katsv.kr/chili/virus/3.jpg",
    ],
    contrastImages: [
      "https://real.katsv.kr/chili/anthracnose/leaf.jpg",
    ],
    actions: {
      doNow: [
        "증상 포기 즉시 격리",
        "작업 도구 소독",
      ],
      doNot: [
        "약제 남용",
        "정상 포기와 접촉 작업",
      ],
      mustCheck: [
        "총채벌레 발생 여부",
        "연속 증상 포기 증가 속도",
      ],
    },
    katsv:
      "https://www.youtube.com/@한국농수산TV/search?query=고추+바이러스",
  },
};

/* ===============================
   POST
================================ */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const image = form.get("image") as File;

    if (!image) {
      return NextResponse.json({ ok: false, error: "이미지 없음" }, { status: 400 });
    }

    /* ① 사진 저장 */
    const buffer = Buffer.from(await image.arrayBuffer());
    const filename = `uploads/${Date.now()}-${image.name}`;
    const file = bucket.file(filename);
    await file.save(buffer, { contentType: image.type });
    await file.makePublic();
    const imageUrl = file.publicUrl();

    /* ② AI 관찰 */
    const ai = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `
너는 농업 병해 관찰 AI다.
병명 단정 금지.
다음 JSON으로만 응답하라.

{
  "issueKey": "고추_탄저병 | 고추_바이러스 | UNKNOWN",
  "confidence": 0~1,
  "observation": "농민이 공감할 관찰 한 줄"
}
          `,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "이 작물 사진을 관찰하라" },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
    });

    const parsed = JSON.parse(ai.choices[0].message.content);
    const matched = CASE_DB[parsed.issueKey];

    /* ③ 기록 저장 */
    await db.collection("diagnosis_records").add({
      imageUrl,
      ai: parsed,
      createdAt: new Date(),
    });

    /* ④ 농민용 결과 반환 */
    return NextResponse.json({
      ok: true,

      summary: matched?.summary || "유사 사례를 더 확인해야 합니다.",
      confidence: parsed.confidence,
      observation: parsed.observation,

      similarImages: matched?.similarImages || [],
      contrastImages: matched?.contrastImages || [],

      actions: matched?.actions || null,

      links: {
        katsv: matched?.katsv || "https://www.youtube.com/@한국농수산TV",
        emergency119:
          "https://docs.google.com/forms/d/e/1FAIpQLSdKgcwl_B-10yU0gi4oareM4iajMPND6JtGIZEwjbwPbnQBEg/viewform",
      },
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { ok: false, error: "서버 오류" },
      { status: 500 }
    );
  }
}