// app/api/question/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();

  // 사진 업로드 후 최초 진입 시
  return NextResponse.json({
    ok: true,
    phase: "QUESTION",

    questions: [
      {
        id: "region",
        type: "select",
        text: "현재 재배 지역을 선택해 주세요.",
        options: [
          "강원",
          "경기",
          "충청",
          "전라",
          "경상",
          "제주",
        ],
      },
      {
        id: "experience_1",
        type: "yesno",
        text: "최근 3일 내 증상이 빠르게 번졌습니까?",
      },
      {
        id: "experience_2",
        type: "yesno",
        text: "비·관수 후 습한 상태가 오래 유지되었습니까?",
      },
    ],
  });
}