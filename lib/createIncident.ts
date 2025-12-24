import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase";

/**
 * Incident 생성 (사진 업로드 직후 1회만 호출)
 * - 3~5년 기본 엔진
 * - 이후 AI / 119 / 히스토리 전부 이 문서에 update
 */
export async function createIncident(params: {
  imageUrl: string;

  cropName?: string | null;

  location?: {
    lat: number;
    lng: number;
  } | null;

  source?: "UPLOAD" | "AI" | "MANUAL";
}) {
  if (!params.imageUrl) {
    throw new Error("imageUrl is required");
  }

  const payload = {
    /** 상태 */
    status: "NEW", // NEW → ANALYZING → DONE → 119_REQUESTED

    /** 기본 정보 */
    cropName: params.cropName ?? null,
    location: params.location ?? null,

    /** 사진 (확장 대비 배열) */
    photos: [
      {
        url: params.imageUrl,
        createdAt: serverTimestamp(),
      },
    ],

    /** AI 결과 (나중에 update) */
    ai: {
      step1: null,
      step2: null,
      updatedAt: null,
    },

    /** 119 연동 (나중에 update) */
    emergency119: {
      requested: false,
      requestedAt: null,
      formUrl: null,
    },

    /** 메타 */
    source: params.source ?? "UPLOAD",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, "incidents"), payload);

  console.log("🔥 Incident 생성 완료:", docRef.id);

  return {
    incidentId: docRef.id,
  };
}