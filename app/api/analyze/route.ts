import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    console.log("==== API ANALYZE START ====");

    const apiKey = process.env.OPENAI_API_KEY;

    console.log("OPENAI_API_KEY:", apiKey ? "FOUND ✅" : "NOT FOUND ❌");

    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is missing");
    }

    const client = new OpenAI({ apiKey });

    const { imageUrl } = await req.json();

    console.log("IMAGE URL:", imageUrl);

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `이 사진 속 작물 병해를 분석해 주세요. 사진 URL: ${imageUrl}`,
        },
      ],
    });

    const result = response.choices[0].message.content;

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (err: any) {
    console.error("🔥 AI ANALYZE ERROR:", err);

    return NextResponse.json({
      ok: false,
      error: err.message || String(err),
    });
  }
}