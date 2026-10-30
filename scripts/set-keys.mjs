// API 열쇠를 .env.local 에 저장 (화면에 안 보이게 입력). 이미 있으면 그대로 두고 Enter.
import fs from "node:fs";
import readline from "node:readline";
const FILE = ".env.local";
const KEYS = [
  ["NCPMS_API_KEY", "NCPMS(병해충관리시스템) Open API 열쇠 — ncpms.rda.go.kr 마이페이지 > Open API 신청내역 (펀토리)"],
  ["DATA_GO_KR_KEY", "공공데이터포털 일반 인증키(Decoding) — data.go.kr 마이페이지 > 데이터활용 > 인증키 (기상청 ASOS 일자료용)"],
];
let text = fs.readFileSync(FILE, "utf8");
const has = (k) => new RegExp(`^${k}=.+`, "m").test(text);
function askHidden(q) {
  return new Promise((res) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(q)) rl.output.write(s); else rl.output.write(s.replace(/[^\r\n]/g, "*")); };
    rl.question(q, (a) => { rl.close(); process.stdout.write("\n"); res(a.trim()); });
  });
}
for (const [k, desc] of KEYS) {
  console.log(`\n[${k}] ${desc}`);
  if (has(k)) { console.log("  이미 저장돼 있음 (바꾸려면 붙여넣기, 그대로 두려면 Enter)"); }
  const v = await askHidden("  붙여넣고 Enter: ");
  if (!v) continue;
  if (has(k)) text = text.replace(new RegExp(`^${k}=.*$`, "m"), `${k}=${v}`);
  else text += (text.endsWith("\n") ? "" : "\n") + `${k}=${v}\n`;
  fs.writeFileSync(FILE, text);
  console.log("  저장됨 ✅");
}
