import { NextResponse } from 'next/server';
import OpenAI from 'openai';

import { db, storage } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const image = formData.get('image') as File;
    const crop = (formData.get('crop') as string) || '미상';
    const province = (formData.get('province') as string) || '미상';
    const city = (formData.get('city') as string) || '미상';

    if (!image) {
      return NextResponse.json({ ok: false, error: '사진이 없습니다.' }, { status: 400 });
    }

    // 1️⃣ 이미지 Storage에 저장
    const buffer = Buffer.from(await image.arrayBuffer());
    const filename = `${Date.now()}_${image.name || 'image.jpg'}`;
    const imageRef = ref(storage, `uploads/${filename}`);
    await uploadBytes(imageRef, buffer, {
      contentType: image.type || 'image/jpeg',
    });
    const imageUrl = await getDownloadURL(imageRef);

    // 2️⃣ OpenAI Vision 분석 요청
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    let analysisNotes = '';
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `
당신은 식물병 전문가입니다. 사용자가 업로드한 작물 사진과 지역 정보를 참고하여 다음 조건에 따라 진단하세요:

[진단 조건]
1. 사진을 기반으로 병해, 생리장해, 해충, 환경 스트레스 중 가장 가능성 높은 원인을 제시하세요.
2. 판단 근거를 구체적으로 설명하세요 (잎의 모양, 색, 반점, 기형 등).
3. 아래 구조로 결과를 출력하세요:

👀 관찰 결과
🌾 작물: ${crop} / 지역: ${province} ${city}
- 관찰 특징 1
- 관찰 특징 2

💡 원인 가능성
질병명A (80%) - 설명
질병명B (20%) - 설명

📌 최종 판단
[가장 가능성 높은 원인]이 의심됩니다.

✅ 지금 해야 할 것
- 조치 1
- 조치 2

⛔ 하지 말 것
- 조치 1

🔍 반드시 확인
- 확인사항 1
- 확인사항 2

👉 이 진단은 참고용입니다. 농업기술센터 상담을 권장합니다.
            `,
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: '작물 진단을 시작해 주세요. 병해, 해충, 생리장해 등을 판단해주세요.' },
              { type: 'image_url', image_url: { url: imageUrl } },
            ] as any,
          },
        ],
        max_tokens: 1500,
      });

      analysisNotes = response.choices[0]?.message?.content || '분석 결과를 불러오지 못했습니다.';
    } catch (err) {
      console.error('❌ OpenAI 분석 실패:', err);
      analysisNotes = '분석 실패: OpenAI Vision 응답 오류';
    }

    // 3️⃣ Firestore 기록 저장 (진단 실패 포함)
    await addDoc(collection(db, 'diagnosis_records'), {
      imageUrl,
      crop,
      province,
      city,
      analysisNotes,
      createdAt: serverTimestamp(),
    });

    // 4️⃣ 클라이언트 응답
    return NextResponse.json({
      ok: true,
      imageUrl,
      analysis_notes: analysisNotes,
    });

  } catch (e: any) {
  console.error('❌ 전체 진단 실패:', e);
  return NextResponse.json({ ok: false, error: e?.message || '서버 오류 발생' }, { status: 500 });
}

}