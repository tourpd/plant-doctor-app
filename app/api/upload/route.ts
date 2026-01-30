import { NextRequest, NextResponse } from "next/server";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { app } from "@/lib/firebase";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "파일이 없습니다." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // ✅ Storage
    const storage = getStorage(app);
    const fileName = `${Date.now()}-${file.name}`;
    const storagePath = `uploads/${fileName}`;

    const fileRef = ref(storage, storagePath);

    await uploadBytes(fileRef, buffer, {
      contentType: file.type,
    });

    const url = await getDownloadURL(fileRef);

    // ✅ Firestore에 업로드 기록 (정렬의 핵심)
    const db = getFirestore(app);
    await addDoc(collection(db, "uploads"), {
      storagePath,
      downloadUrl: url,
      originalName: file.name,
      contentType: file.type,
      size: buffer.length,
      createdAt: serverTimestamp(),
    });

    return NextResponse.json({
      ok: true,
      url,            // 🔥 기존 응답 유지 (절대 깨지지 않음)
    });
  } catch (err: any) {
    console.error("UPLOAD ERROR", err);
    return NextResponse.json(
      { error: "업로드 실패" },
      { status: 500 }
    );
  }
}
