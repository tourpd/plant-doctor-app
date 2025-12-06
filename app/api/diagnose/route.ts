import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("image") as File;

    if (!file) {
      return NextResponse.json({ error: "No image uploaded" }, { status: 400 });
    }

    // convert uploaded image to data URL
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    const mimeType = file.type || "image/jpeg";

    const imageUrl = `data:${mimeType};base64,${base64}`;

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: "이 작물 병해를 진단해줘." },
            {
              type: "input_image",
              image_url: imageUrl,
            },
          ],
        },
      ],
    });

    const output =
      response.output_text ||
      response.output?.[0]?.content?.[0]?.text ||
      "진단 결과를 생성하지 못했습니다.";

    return NextResponse.json({
      success: true,
      result: output,
    });
  } catch (err: any) {
    console.error("Diagnose API Error:", err);
    return NextResponse.json(
      { error: err.message || "Diagnose failed" },
      { status: 500 }
    );
  }
}
