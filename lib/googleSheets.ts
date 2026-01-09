// lib/googleSheets.ts
import { GoogleSpreadsheet } from "google-spreadsheet";

const SHEET_ID = process.env.GOOGLE_SHEET_ID!;
const CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
const PRIVATE_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!;

export async function appendToSheet(row: Record<string, any>) {
  const doc = new GoogleSpreadsheet(SHEET_ID);

  await doc.useServiceAccountAuth({
    client_email: CLIENT_EMAIL,
    private_key: PRIVATE_KEY.replace(/\\n/g, "\n"),
  });

  await doc.loadInfo();

  const tabName = process.env.GOOGLE_SHEET_TAB_NAME || "diagnoses";
  const sheet = doc.sheetsByTitle[tabName];
  if (!sheet) throw new Error(`Sheet tab not found: ${tabName}`);

  await sheet.addRow(row);
}