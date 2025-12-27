// lib/uploadImage.ts
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

export async function uploadImage(file: File) {
  // 🔹 시간 기반 파일명 (충돌 없음)
  const filename = `${Date.now()}_${file.name}`;
  const imageRef = ref(storage, `uploads/${filename}`);

  // 🔹 실제 업로드
  await uploadBytes(imageRef, file);

  // 🔹 외부 접근 URL
  const downloadURL = await getDownloadURL(imageRef);

  return {
    filename,
    downloadURL,
  };
}