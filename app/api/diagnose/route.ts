import { NextResponse } from "next/server";
import OpenAI from "openai";

import { db, storage } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const image = formData.get("image") as File | null;

    if (!image) {
      return NextResponse.json(
        { ok: false, error: "사진이 없습니다." },
        { status: 400 }
      );
    }

    /* =========================
       1️⃣ 사진 Storage 저장 (무조건)
    ========================= */
    const buffer = Buffer.from(await image.arrayBuffer());
    const filename = `${Date.now()}_${image.name || "image.jpg"}`;
    const imageRef = ref(storage, `uploads/${filename}`);

    await uploadBytes(imageRef, buffer, {
      contentType: image.type || "image/jpeg",
    });

    const imageUrl = await getDownloadURL(imageRef);

    /* =========================
       2️⃣ OpenAI STEP1 내부 분석 (Responses API)
    ========================= */
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      temperature: 0.3,
      input: [
        {
          role: "system",
          content: `
너는 사진을 보고 내부적으로만 판단하는 분석 AI다.

[규칙]
- 농민에게 보여줄 문장 생성 금지
- 병명 단정 금지
- 결과는 화면 출력용이 아니다
- 관찰 포인트와 불확실성만 내부 메모로 정리한다
          `,
        },
        {
          role: "user",
          content: [
            { type: "input_text", text: "이 사진을 내부 분석용으로만 관찰해라" },
            {
              type: "input_image",
              image_url: imageUrl, detail: "auto",// ✅ base64 대신 Storage URL 사용
            },
          ],
        },
      ],
    });

    const analysisNotes =
      response.output_text ||
      "";

    /* =========================
       3️⃣ Firestore 기록 저장 (핵심 자산)
    ========================= */
    await addDoc(collection(db, "diagnosis_records"), {
      imageUrl,
      analysisNotes,
      step: "STEP1",
      createdAt: serverTimestamp(),
      source: "user",
    });

    /* =========================
       4️⃣ 응답 반환
    ========================= */
    return NextResponse.json({
      ok: true,
      step: "STEP1",
      analysis_notes: analysisNotes,
      imageUrl,
    });
  } catch (e) {
    console.error("STEP1 분석 실패:", e);
    return NextResponse.json(
      { ok: false, error: "STEP1 분석 실패" },
      { status: 500 }
    );
  }
}