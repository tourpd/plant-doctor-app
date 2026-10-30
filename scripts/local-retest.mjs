// 포토닥터 재시험 — 이 맥에서 새 코드를 띄워 시험지 비교만 다시 (배포 없음, 운영 안 건드림)
import fs from "node:fs";
import { spawn, spawnSync } from "node:child_process";
fs.mkdirSync("scripts/out", { recursive: true });
const LOG = "scripts/out/retest_run.log";
fs.writeFileSync(LOG, `시작 ${new Date().toString()}\n`);
const log = (...a) => { const s = a.join(" "); console.log(s); fs.appendFileSync(LOG, s + "\n"); };
const br = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" }).stdout.trim();
if (br !== "upgrade-2026-11") { log("❌ 브랜치가 upgrade-2026-11 이 아닙니다"); process.exit(1); }
// 전에 띄워 둔 시험 서버가 남아 있으면 정리
spawnSync("sh", ["-c", "lsof -ti tcp:3939 | xargs kill 2>/dev/null; sleep 1"]);
log("① 새 코드를 이 맥에서 띄우는 중...");
const dev = spawn("npx", ["next", "dev", "-p", "3939"], { stdio: "ignore", detached: true });
const stop = () => { try { process.kill(-dev.pid); } catch {} };
process.on("exit", stop);
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { stop(); process.exit(130); });
const T = "http://localhost:3939";
let up = false;
for (let i = 0; i < 90 && !up; i++) { await new Promise((s) => setTimeout(s, 2000)); try { await fetch(T); up = true; } catch {} }
if (!up) { log("❌ 로컬 서버가 안 뜸"); process.exit(1); }
log("② 시험지 비교 시작 (20~30분) — 진행 상황: scripts/out/compare_progress.log");
const c = spawnSync("node", ["scripts/compare-49.mjs"], { encoding: "utf8", env: { ...process.env, PREVIEW_URL: T }, stdio: ["inherit", "pipe", "inherit"], maxBuffer: 1 << 26 });
log(c.stdout || "");
log(c.status === 0 ? "✅ 끝" : "❌ 비교 실패");
stop(); process.exit(c.status ?? 1);
