import { NextResponse } from "next/server";
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export const runtime = "nodejs";

/**
 * Incident 생성
 * POST /api/incidents
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const docRef = await addDoc(collection(db, "incidents"), {
      source: body?.source ?? "PHOTO_UPLOAD",
      status: "CREATED",
      imageUrl: body?.imageUrl ?? null,
      summary: "",
      visionNotes: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return NextResponse.json({
      ok: true,
      incidentId: docRef.id,
    });
  } catch (e) {
    console.error("incident 생성 실패:", e);
    return NextResponse.json(
      { error: "incident 생성 실패" },
      { status: 500 }
    );
  }
}

/**
 * Incident 리스트 조회 (운영용)
 * GET /api/incidents?limit=20
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limitCount = Number(searchParams.get("limit") ?? 20);

    const q = query(
      collection(db, "incidents"),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    );

    const snap = await getDocs(q);

    const items = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      ok: true,
      items,
    });
  } catch (e) {
    console.error("incident 리스트 조회 실패:", e);
    return NextResponse.json(
      { error: "incident 리스트 조회 실패" },
      { status: 500 }
    );
  }
}
