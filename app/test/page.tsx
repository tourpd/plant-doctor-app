'use client';

import { doc, setDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase"; // 실제 경로 확인

export default function TestPage() {
  const testUpload = async () => {
    const diagnosisRef = doc(collection(db, "diagnoses"));
    await setDoc(diagnosisRef, {
      createdAt: new Date().toISOString(),
      region: "경상북도",
      ok: true,
      observations: ["잎이 노랗다", "곰팡이 흔적", "잎 끝 말림"],
      possible_causes: [
        {
          name: "질소 부족",
          probability: 0.85,
          why: "색이 노랗고, 생육 부진",
        },
        {
          name: "곰팡이병",
          probability: 0.65,
          why: "잎 표면의 흰가루",
        },
      ],
    });
    alert("✅ Firestore 테스트 업로드 완료");
  };

  return (
    <main style={{ padding: 40 }}>
      <h1>Firestore 테스트 페이지</h1>
      <button onClick={testUpload} style={{ padding: 12, fontSize: 16 }}>
        업로드 트리거 실행
      </button>
    </main>
  );
}