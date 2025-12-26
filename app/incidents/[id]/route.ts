import { NextRequest, NextResponse } from "next/server";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export const runtime = "nodejs";

/**
 * Incident 단건 조회
 * GET /api/incidents/[id]
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ ok: false, error: "id가 없습니다." }, { status: 400 });
    }

    const ref = doc(db, "incidents", id);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      item: {
        id: snap.id,
        ...(snap.data() as Record<string, any>),
      },
    });
  } catch (err) {
    console.error("[INCIDENT GET ERROR]", err);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}