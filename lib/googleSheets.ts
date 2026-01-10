// lib/googleSheets.ts
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

const SHEET_ID = process.env.GOOGLE_SHEETS_ID!;
const CLIENT_EMAIL = process.env.GOOGLE_SHEETS_CLIENT_EMAIL!;
const PRIVATE_KEY = process.env.GOOGLE_SHEETS_PRIVATE_KEY!;
const TAB_NAME = process.env.GOOGLE_SHEETS_TAB_NAME || "Sheet1";

// ✅ 헤더/키 정규화: 공백 + 보이지 않는 문자 제거
function norm(s: string) {
  return (s || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // zero-width 제거
    .trim();
}

export async function appendToSheet(row: Record<string, any>) {
  if (!SHEET_ID) throw new Error("Missing env: GOOGLE_SHEETS_ID");
  if (!CLIENT_EMAIL) throw new Error("Missing env: GOOGLE_SHEETS_CLIENT_EMAIL");
  if (!PRIVATE_KEY) throw new Error("Missing env: GOOGLE_SHEETS_PRIVATE_KEY");

  const auth = new JWT({
    email: CLIENT_EMAIL,
    key: PRIVATE_KEY.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  // ✅ 타입 에러 해결: 생성자 인자 2개
  const doc = new GoogleSpreadsheet(SHEET_ID, auth);
  await doc.loadInfo();

  console.log("✅ Spreadsheet title:", doc.title);
  console.log(
    "📄 Sheets:",
    doc.sheetsByIndex.map((s: any, i: number) => `${i}:${s.title}`)
  );
  console.log("🎯 Target TAB_NAME:", TAB_NAME);

  const sheet = doc.sheetsByTitle[TAB_NAME];
  if (!sheet) throw new Error(`❌ Sheet tab not found: ${TAB_NAME}`);

  await sheet.loadHeaderRow();

  const rawHeaders: string[] = sheet.headerValues || [];
  const headers = rawHeaders.map(norm).filter(Boolean);

  console.log("🧾 Raw headers:", rawHeaders);
  console.log("🧾 Normalized headers:", headers);

  // row 키도 정규화해서 비교
  const rawRowKeys = Object.keys(row);
  const rowKeys = rawRowKeys.map(norm);

  // ✅ row payload도 정규화 키로 재구성 (헤더와 정확히 매칭)
  const normalizedRow: Record<string, any> = {};
  for (let i = 0; i < rawRowKeys.length; i++) {
    normalizedRow[norm(rawRowKeys[i])] = row[rawRowKeys[i]];
  }

  const missingInSheet = rowKeys.filter((k) => !headers.includes(k));
  if (missingInSheet.length > 0) {
    throw new Error(
      `❌ Header mismatch. These keys are not in sheet headers: ${missingInSheet.join(
        ", "
      )}`
    );
  }

  // (참고) 시트는 있는데 row에 없는 헤더는 빈칸으로 들어감
  const missingInRow = headers.filter((h) => !(h in normalizedRow));
  if (missingInRow.length > 0) {
    console.log("ℹ️ Row missing headers (will be blank):", missingInRow);
  }

  console.log("🧾 Sheet row payload (normalized):", normalizedRow);

  const added = await sheet.addRow(normalizedRow);
  console.log("✅ Google Sheet 저장 완료. rowNumber:", added?.rowNumber);

  return true;
}