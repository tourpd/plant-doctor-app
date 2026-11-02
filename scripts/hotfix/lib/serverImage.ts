// 서버로 들어온 사진을 AI가 읽을 수 있는 표준 JPEG로 맞춘다.
// - HEIC/HEIF(갤럭시 '고효율 사진', 아이폰 기본): AI가 못 읽음 → JPEG로 변환
// - EXIF 회전 반영, 긴 변 1600px로 축소 (AI 비용·저장 용량도 줄어듦)
// - 변환이 실패해도 원본으로 계속 진행 (기존 동작 보존)
import sharp from "sharp";

const MAX_SIDE = 1600;

export function looksLikeHeic(buf: Buffer, mime = "", name = "") {
  if (/hei[cf]/i.test(mime) || /\.(heic|heif)$/i.test(name)) return true;
  if (buf.length < 12) return false;
  const box = buf.toString("ascii", 4, 8);
  const brand = buf.toString("ascii", 8, 12);
  return box === "ftyp" && /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(brand);
}

export type NormalizedImage = { buffer: Buffer; mime: string; note: string };

export async function normalizeImage(input: Buffer, mime = "", name = ""): Promise<NormalizedImage> {
  let buf = input;
  const notes: string[] = [];
  if (looksLikeHeic(buf, mime, name)) {
    try {
      const mod: any = await import("heic-convert");
      const convert = mod.default || mod;
      const out = await convert({ buffer: buf, format: "JPEG", quality: 0.9 });
      buf = Buffer.from(out);
      notes.push("heic→jpeg");
    } catch (e: any) {
      notes.push("heic-convert-failed:" + (e?.message || e));
    }
  }
  try {
    const out = await sharp(buf, { failOn: "none", limitInputPixels: 300_000_000 })
      .rotate() // EXIF 회전 반영
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
    notes.push(`jpeg ${input.length}→${out.length}B`);
    return { buffer: out, mime: "image/jpeg", note: notes.join(", ") };
  } catch (e: any) {
    notes.push("sharp-failed:" + (e?.message || e));
    return { buffer: buf, mime: notes.includes("heic→jpeg") ? "image/jpeg" : mime || "image/jpeg", note: notes.join(", ") };
  }
}
