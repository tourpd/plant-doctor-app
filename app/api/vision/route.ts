// app/api/vision/route.ts
// @ts-nocheck
import { NextResponse } from "next/server";
import OpenAI from "openai";

import { getStorage } from "firebase-admin/storage";
import { initializeApp, getApps, cert } from "firebase-admin/app";

export const runtime = "nodejs";

/* ===============================
   Firebase Admin 초기화
================================ */
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET, // ⭐ 핵심
  });
}

const bucket = getStorage().bucket();

/* ===============================
   OpenAI
================================ */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/* ===============================
   POST
================================ */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const image = form.get("image") as File;
    const action = form.get("action") as string;

    if (!image) {
      return NextResponse.json({ ok: false, error: "이미지 없음" }, { status: 400 });
    }

    /* ===============================
       🔥 1️⃣ Firebase Storage 업로드 (이게 그동안 없었음)
    ================================ */
    const buffer = Buffer.from(await image.arrayBuffer());
    const filename = `uploads/${Date.now()}-${image.name}`;

    const file = bucket.file(filename);

    await file.save(buffer, {
      contentType: image.type,
    });

    await file.makePublic();

    const imageUrl = file.publicUrl();

    /* ===============================
       2️⃣ OpenAI Vision
    ================================ */
    const vision = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "이 작물 사진을 보고 병해충 또는 생육 문제를 분석해줘" },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
    });

    return NextResponse.json({
      ok: true,
      imageUrl, // ✅ 저장된 Firebase 이미지 URL
      result: vision.choices[0].message.content,
    });
  } catch (e: any) {
    console.error("VISION ERROR:", e);
    return NextResponse.json(
      { ok: false, error: e.message || "서버 오류" },
      { status: 500 }
    );
  }
}