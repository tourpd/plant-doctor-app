// 갤럭시 Z폴드 사진 시험 — 대용량(50MP)·회전·HEIC 사진이 진단 서버에서 제대로 읽히는지 (배포 없음, 저장 없음)
import fs from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import sharp from "sharp";
fs.mkdirSync("scripts/out/imgtest", { recursive: true });
const LOG = "scripts/out/image_test.log";
fs.writeFileSync(LOG, `시작 ${new Date().toString()}\n`);
const log = (...a) => { const s = a.join(" "); console.log(s); fs.appendFileSync(LOG, s + "\n"); };

// 1) 시험 사진 만들기: 실제 고추 탄저병 사례 사진 → Z폴드 50MP 크기
const cases = JSON.parse(fs.readFileSync("app/data/knowledge/ncpms_cases.json", "utf8"));
const arr = Array.isArray(cases) ? cases : cases.cases;
const pick = arr.find((x) => /고추/.test(x.crop) && /탄저/.test(x.pest || "") && x.images?.length);
const src = Buffer.from(await (await fetch(pick.images[0])).arrayBuffer());
log("원본 사례:", pick.crop, pick.pest, src.length, "B");
const W = 8160, H = 6120; // Z폴드4 50MP
const base = await sharp(src).resize(W, H, { fit: "fill" }).toBuffer();
// 촬영 사진처럼 잔결(노이즈)을 섞어 실제 용량에 가깝게
const noise = Buffer.alloc(W * H * 3); for (let i = 0; i < noise.length; i++) noise[i] = 118 + Math.floor(Math.random() * 20);
const noisy = await sharp(base).composite([{ input: await sharp(noise, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer(), blend: "soft-light" }]).toBuffer();
const D = "scripts/out/imgtest";
fs.writeFileSync(`${D}/50mp.jpg`, await sharp(noisy).jpeg({ quality: 95 }).toBuffer());
// 세로로 들고 찍은 사진: 화소는 가로, EXIF 회전값 6 (갤럭시 기본 저장 방식)
fs.writeFileSync(`${D}/rotated12mp.jpg`, await sharp(noisy).resize(4000, 3000).jpeg({ quality: 92 }).withMetadata({ orientation: 6 }).toBuffer());
// HEIC (갤럭시 '고효율 사진' 켠 경우) — 맥 기본 도구 sips 로 변환
const s = spawnSync("sips", ["-s", "format", "heic", `${D}/rotated12mp.jpg`, "--out", `${D}/photo.heic`], { encoding: "utf8" });
const files = [["50MP JPEG", "50mp.jpg", "image/jpeg"], ["세로(EXIF 회전) JPEG", "rotated12mp.jpg", "image/jpeg"]];
if (s.status === 0 && fs.existsSync(`${D}/photo.heic`)) files.push(["HEIC(고효율 사진)", "photo.heic", "image/heic"]);
else log("⚠️ HEIC 시험 파일 생성 실패:", s.stderr);
files.push(["형식 표시 없는 HEIC", "photo.heic", ""]);
for (const [n, f] of files) if (fs.existsSync(`${D}/${f}`)) log(`  · ${n}: ${(fs.statSync(`${D}/${f}`).size / 1048576).toFixed(1)}MB`);

// 2) 이 맥에서 새 코드 띄우기
spawnSync("sh", ["-c", "lsof -ti tcp:3939 | xargs kill 2>/dev/null; sleep 1"]);
log("① 새 코드를 이 맥에서 띄우는 중...");
const dev = spawn("npx", ["next", "dev", "-p", "3939"], { stdio: ["ignore", fs.openSync("scripts/out/imgtest_server.log", "w"), fs.openSync("scripts/out/imgtest_server.log", "a")], detached: true });
const stop = () => { try { process.kill(-dev.pid); } catch {} };
process.on("exit", stop);
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { stop(); process.exit(130); });
const T = "http://localhost:3939";
let up = false;
for (let i = 0; i < 90 && !up; i++) { await new Promise((r) => setTimeout(r, 2000)); try { await fetch(T + "/ai"); up = true; } catch {} }
if (!up) { log("❌ 로컬 서버가 안 뜸"); process.exit(1); }

// 3) 진단 요청 (시험 기기 → 저장 안 됨)
log("② 진단 시험");
let pass = 0;
for (const [n, f, type] of files) {
  if (!fs.existsSync(`${D}/${f}`)) continue;
  const fd = new FormData();
  fd.append("image", new Blob([fs.readFileSync(`${D}/${f}`)], type ? { type } : {}), f);
  fd.append("crop", "고추"); fd.append("province", "충청남도"); fd.append("city", "논산시");
  fd.append("device_id", "claude-system-check");
  const t0 = Date.now();
  try {
    const r = await fetch(T + "/api/vision", { method: "POST", body: fd, signal: AbortSignal.timeout(150000) });
    const j = await r.json().catch(() => null);
    const ok = r.ok && j?.ok && (j.possible_causes || []).length > 0;
    if (ok) pass++;
    log(`  ${ok ? "✅" : "❌"} ${n} → ${r.status} ${ok ? (j.possible_causes || []).slice(0, 3).map((c) => `${c.name} ${c.probability}%`).join(" / ") : (j?.error || "응답 오류")} (${((Date.now() - t0) / 1000).toFixed(0)}초)`);
  } catch (e) { log(`  ❌ ${n} → ${e.message}`); }
}
const srv = fs.readFileSync("scripts/out/imgtest_server.log", "utf8").split("\n").filter((l) => l.includes("[vision] image"));
for (const l of srv) log("  서버:", l.trim());
log(pass === files.length ? `✅ 끝 — ${pass}/${files.length} 모두 인식` : `❌ ${pass}/${files.length}만 인식`);
stop(); process.exit(0);
