import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File;

    if (!file) {
      return NextResponse.json({
        ok: false,
        error: "이미지 파일이 전달되지 않았습니다."
      });
    }

    // ✅ 임시 AI 리포트 (실서비스 포맷)
    return NextResponse.json({

      ok: true,

      crop: "양파",

      diagnosis: "노균병 초기 의심",

      reason: `
잎 표면에 회백색 반점이 퍼지며
습한 환경에서 빠르게 확산되는 곰팡이성 병입니다.
최근 강우 및 배수 불량, 통풍 부족 상황일 때
집단 발병 사례가 증가합니다.
`,

      solution: `
① 감염 잎 즉시 제거
② 배수 정비 + 환기 강화
③ 등록약제 살포
   - 디메토모르프계
   - 만코제브 혼용 가능
④ 7일 간격 2~3회 연속 방제
`,

      caution: `
연작 시 재발 가능성 높아 윤작 권장
살균제 동일 성분 연속 사용 금지
`
    });

  } catch (err) {
    console.error(err);

    return NextResponse.json({
      ok: false,
      error: "진단 서버 에러"
    });
  }
}
