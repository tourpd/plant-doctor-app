import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;

    if (!file) {
      return NextResponse.json({
        ok: false,
        error: "이미지 파일이 전달되지 않았습니다.",
      });
    }

    // 실제 AI 분석은 나중에 연결
    // 지금은 테스트용 더미 결과 반환

    return NextResponse.json({
      ok: true,
      crop: "양파",
      diagnosis: "노균병 의심",
      reason: "잎 표면의 회색 반점과 병반 확산",
      solution:
        "배수 개선, 감염주 제거, 등록 약제(만코제브, 디메토모르프) 7일 간격 살포",
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: "서버 분석 중 오류가 발생했습니다.",
    });
  }
}
