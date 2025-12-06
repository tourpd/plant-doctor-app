import { NextResponse } from "next/server";

export async function POST(req:Request){

  try{

    const data = await req.formData();
    const file = data.get("file");

    if(!file){
      return NextResponse.json({
        ok:false,
        error:"사진 파일이 접수되지 않았습니다."
      });
    }

    // ✅ 전문가 리포트 고정 출력
    return NextResponse.json({

      ok:true,

      crop:"옥수수",

      diagnosis:"멸강나방 · 나방류 피해 의심",

      symptoms:`
열매 상단 및 측면이 불규칙하게 파여 있음
수액 흐른 흔적, 벌레 분변배설물 발견
껍질 손상 부위가 갈변되며 상품가치 급락
`,

      reason:`
고온·다습 조건에서 나방 유충 급증
알 부화 직후 열악지 또는 심부로 침투
방제 적기를 놓치면 피해가 급속 확대됨
`,

      solution:`
① BT제 또는 유충 전용 약제 살포 (7일 간격 반복)
② 피해 과실 제거
③ 유인등 및 페로몬 트랩 설치
④ 발생 초기에 예방적 약제 살포 권장
`,

      caution:`
동일 약제 연속 살포 금지
살충제 저항성 관리 필수
시설 및 주위 잡초 제거 철저
`

    });

  }catch(err:any){

    return NextResponse.json({
      ok:false,
      error:"AI 서버 처리 오류"
    });

  }

}
