// app/api/analyze/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "파일이 없습니다." },
        { status: 400 }
      );
    }

    // 여기서 file.arrayBuffer() 써서 바이너리 변환
    const buffer = Buffer.from(await file.arrayBuffer());

    // 예: gpt-4o-mini vision 호출 (실제 프롬프트는 취향대로 수정)
    const result = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: "이 사진의 작물 병해를 농민에게 설명해 주세요." },
            {
              type: "input_image",
              image: {
                data: buffer.toString("base64"),
                format: "jpeg", // 또는 png 등 업로드한 확장자에 맞게
              },
            },
          ],
        },
      ],
    });

    const markdown =
      result.output[0]?.content[0]?.text ?? "설명문을 가져오지 못했습니다.";

    return NextResponse.json({ success: true, markdown });
  } catch (err: any) {
    console.error("API /api/analyze 에러:", err);
    return NextResponse.json(
      { success: false, error: err.message ?? "서버 에러" },
      { status: 500 }
    );
  }
}