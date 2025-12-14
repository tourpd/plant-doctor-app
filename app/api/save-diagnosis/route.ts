import { NextResponse } from "next/server";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      imageUrl,
      gps,
      crop,
      disease,
      synonyms,
      season,
      diagnosisText,
      createdAt,
    } = body;

    await db.collection("diagnosis").add({
      imageUrl,
      gps,
      crop,
      disease,
      synonyms,
      season,
      diagnosisText,
      createdAt: createdAt || Date.now(),
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("SAVE ERROR:", err);
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}
