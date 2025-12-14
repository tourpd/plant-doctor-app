// app/api/pepper-decision/route.ts

import { NextResponse } from "next/server";
import pepperEngineDecision from "@/engines/pepper.engine";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const result = pepperEngineDecision(body);

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: "판결 엔진 오류" },
      { status: 500 }
    );
  }
}