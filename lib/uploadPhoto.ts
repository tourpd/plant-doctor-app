import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { app } from "@/lib/firebase";

// 🔒 Storage 인스턴스를 파일 상단에서 단 1번만 생성
const storage = getStorage(app);

export async function uploadPhoto(file: File): Promise<string> {
  if (!file) throw new Error("파일이 없습니다.");

  console.log("🔥 uploadPhoto 시작", file.name, file.size);

  // 경로: photos/yyyy-mm-dd/timestamp_filename.jpg
  const date = new Date().toISOString().slice(0, 10);
  const safeName = file.name.replace(/\s+/g, "_");
  const path = `photos/${date}/${Date.now()}_${safeName}`;

  try {
    const storageRef = ref(storage, path);

    await uploadBytes(storageRef, file);

    const url = await getDownloadURL(storageRef);

    console.log("✅ Firebase 업로드 완료:", url);
    return url;
  } catch (err) {
    console.error("❌ Firebase uploadPhoto 실패:", err);
    throw err;
  }
}