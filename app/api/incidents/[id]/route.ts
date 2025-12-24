cat << 'EOF' > "app/api/incidents/[id]/route.ts"
import { NextResponse } from "next/server";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase";

export const runtime = "nodejs";

/**
 * Incident 단건 조회
 * GET /api/incidents/[id]
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const incidentId = params.id;

    if (!incidentId) {
      return NextResponse.json(
        { error: "incidentId가 없습니다." },
        { status: 400 }
      );
    }

    const ref = doc(db, "incidents", incidentId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      return NextResponse.json(
        { error: "incident를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      item: {
        id: snap.id,
        ...snap.data(),
      },
    });
  } catch (e) {
    console.error("incident 단건 조회 실패:", e);
    return NextResponse.json(
      { error: "incident 단건 조회 실패" },
      { status: 500 }
    );
  }
}
EOF
