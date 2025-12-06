import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

console.log("API_KEY_EXISTS:", !!process.env.OPENAI_API_KEY);

export async function POST(req: NextRequest) {
  try {
    console.log("API_KEY_VALUE_PREFIX:", process.env.OPENAI_API_KEY?.slice(0, 8));

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is missing on server" },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No image file received" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Image = buffer.toString("base64");
    const imageUrl = `data:image/jpeg;base64,${base64Image}`;

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const result = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: "작물 병해인지 분석해 주세요." },
            {
              type: "input_image",
              image_url: imageUrl,
              detail: "auto"
            },
          ],
        },
      ],
    });

    return NextResponse.json(result);

  } catch (err: any) {
    console.error("DIAGNOSE_API_ERROR:", err);
    return NextResponse.json(
      { error: err?.message || "Unknown Server Error" },
      { status: 500 }
    );
  }
}
