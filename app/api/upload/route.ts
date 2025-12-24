import { NextResponse } from "next/server";
import { bucket } from "@/lib/firebaseAdmin";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "파일이 없습니다." },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const filename = `photos/${Date.now()}-${uuidv4()}-${file.name}`;

    const blob = bucket.file(filename);

    await blob.save(bytes, {
      contentType: file.type,
      resumable: false,
    });

    await blob.makePublic();

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;

    return NextResponse.json({ url: publicUrl });
  } catch (err: any) {
    console.error("🔥 업로드 API 에러:", err);
    return NextResponse.json(
      { error: err.message || "업로드 실패" },
      { status: 500 }
    );
  }
}