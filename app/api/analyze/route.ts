import { NextResponse } from "next/server";

// ✅ 새 엔진(진짜 두뇌)
import { POST as DiagnoseNewPOST } from "../diagnose-new/route";

export async function POST(req: Request) {
  // 1) 그대로 새 엔진 호출
  const res = await DiagnoseNewPOST(req);

  // 2) 새 엔진 응답을 JSON으로 읽어서,
  const data = await res.json().catch(() => null);

  // 3) 기존 UI가 기대하는 형태로 "호환 변환"
  //    UI: data.ok ? data.result : data.error
  if (!data) {
    return NextResponse.json(
      { ok: false, error: "진단 엔진 응답 파싱 실패" },
      { status: 500 }
    );
  }

  if (data.ok) {
    // 새 엔진이 어떤 JSON을 주든, 화면에 보여줄 텍스트 result를 만들어줌
    const resultText =
      data.resultText ||
      data.result ||
      data.message ||
      JSON.stringify(data, null, 2);

    return NextResponse.json({ ok: true, result: resultText });
  }

  return NextResponse.json(
    { ok: false, error: data.error || "진단 실패" },
    { status: 500 }
  );
}
