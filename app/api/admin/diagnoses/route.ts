// app/api/admin/diagnoses/route.ts

import { NextResponse } from "next/server";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Firebase Admin 초기화
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();

export async function GET() {
  const snapshot = await db
    .collection('diagnoses')
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  const data = snapshot.docs.map((doc) => doc.data());

  return NextResponse.json(data);
}