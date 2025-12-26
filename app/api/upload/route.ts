import { NextRequest, NextResponse } from "next/server";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
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

    // ⚠️ 여기서만 storage 생성 (빌드 타임 방지)
    const storage = getStorage(app);
    const fileRef = ref(
      storage,
      `uploads/${Date.now()}-${file.name}`
    );

    await uploadBytes(fileRef, buffer, {
      contentType: file.type,
    });

    const url = await getDownloadURL(fileRef);

    return NextResponse.json({
      ok: true,
      url,
    });
  } catch (err: any) {
    console.error("UPLOAD ERROR", err);
    return NextResponse.json(
      { error: "업로드 실패" },
      { status: 500 }
    );
  }
}