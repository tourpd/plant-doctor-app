// 휴대폰 사진을 서버로 보내기 전에 정리한다.
// - 갤럭시 Z폴드 등 고화소(12~50MP)·모션포토 사진은 원본이 4.5MB(Vercel 한도)를 넘어 업로드가 실패했음
// - 회전 정보(EXIF)를 반영해 바로 세운 뒤, 긴 변 1600px JPEG로 줄인다 (진단 정확도에는 충분)
// - 휴대폰이 해독하지 못하는 형식(HEIC 등)은 원본 그대로 보내고, 서버가 변환한다

const MAX_SIDE = 1600;
const QUALITY = 0.85;
export const SERVER_LIMIT = 4 * 1024 * 1024; // Vercel 4.5MB 한도에 여유를 둠

function isHeic(file: File) {
  return /hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
}

async function decode(file: File): Promise<{ src: CanvasImageSource; w: number; h: number; close: () => void }> {
  // 1) createImageBitmap: EXIF 회전 반영
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
      return { src: bmp, w: bmp.width, h: bmp.height, close: () => bmp.close() };
    } catch {
      /* 아래 방식으로 재시도 */
    }
  }
  // 2) <img> 방식 (최신 브라우저는 EXIF 회전을 자동 반영)
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode-failed"));
      el.src = url;
    });
    return { src: img, w: img.naturalWidth, h: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

export type PreparedImage = { file: File; converted: boolean; originalBytes: number; note?: string };

export async function prepareImageForUpload(file: File): Promise<PreparedImage> {
  const originalBytes = file.size;
  let decoded;
  try {
    decoded = await decode(file);
  } catch {
    // 휴대폰이 못 읽는 형식(주로 HEIC) → 원본 그대로, 서버에서 변환
    return { file, converted: false, originalBytes, note: isHeic(file) ? "heic-raw" : "decode-failed" };
  }
  try {
    const { src, w, h } = decoded;
    if (!w || !h) throw new Error("empty");
    const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
    const tw = Math.max(1, Math.round(w * scale));
    const th = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no-canvas");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, tw, th);
    ctx.drawImage(src, 0, 0, tw, th);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", QUALITY));
    canvas.width = canvas.height = 0; // 휴대폰 메모리 반환
    if (!blob || blob.size < 1000) throw new Error("encode-failed");
    const name = (file.name || "photo").replace(/\.[^.]+$/, "") + ".jpg";
    return { file: new File([blob], name, { type: "image/jpeg" }), converted: true, originalBytes };
  } catch {
    return { file, converted: false, originalBytes, note: "encode-failed" };
  } finally {
    decoded.close();
  }
}
