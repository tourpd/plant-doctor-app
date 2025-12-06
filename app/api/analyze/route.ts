import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {

  const formData = await req.formData();

  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({
      ok: false,
      error: "이미지 파일이 전달되지 않았습니다."
    });
  }

  // 실제 AI 연결 전 테스트 결과 반환
  return NextResponse.json({
    ok: true,

    crop: "옥수수",

    diagnosis: "해충 피해 의심",

    reason:
      "열매 표면의 천공, 수액 흔적, 벌레 배설물 관찰",

    solution:
      "BT 살충제 살포, 유충 직접 제거, 유인트랩 설치"
  });
}
