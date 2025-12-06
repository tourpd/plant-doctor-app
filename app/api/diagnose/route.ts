import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("image") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No image uploaded" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    const mime = file.type || "image/jpeg";

    const imageDataUrl = `data:${mime};base64,${base64}`;

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "이 작물 병해를 진단해 주세요."
            },
            {
              type: "input_image",
              image_url: imageDataUrl
            }
          ]
        }
      ]
    });

    return NextResponse.json({
      success: true,
      result:
        response.output_text ||
        response.output?.[0]?.content?.[0]?.text ||
        "결과를 생성하지 못했습니다."
    });

  } catch (err: any) {
    console.error("DIAGNOSE ERROR:", err);
    return NextResponse.json(
      { error: err?.message || "Internal error" },
      { status: 500 }
    );
  }
}
