import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * 📌 진단 데이터 최초 저장
 * - 사진 업로드 직후 무조건 호출
 * - AI 결과 없어도 저장
 */
export async function saveDiagnosis(data: {
  imageUrl: string;
  crop: string | null;
  possibleDiseases: string[];
  summary: string;
  source: "UPLOAD_ONLY" | "AI_RESULT" | "119_REQUEST";
}) {
  if (!data.imageUrl) {
    throw new Error("imageUrl is required");
  }

  const payload = {
    imageUrl: data.imageUrl,
    crop: data.crop ?? null,
    possibleDiseases: data.possibleDiseases ?? [],
    summary: data.summary ?? "",
    source: data.source,
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, "diagnoses"), payload);

  console.log("✅ saveDiagnosis 성공:", docRef.id);

  return docRef.id; // ⭐️ 이 ID가 다음 단계 핵심
}