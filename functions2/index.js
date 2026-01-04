const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const { google } = require("googleapis");

// 🔐 비밀 정의
const CLIENT_EMAIL = defineSecret("CLIENT_EMAIL");
const PRIVATE_KEY = defineSecret("PRIVATE_KEY");
const SHEET_ID = defineSecret("SHEET_ID");

// Firebase Admin 초기화
admin.initializeApp();

exports.backupOnWrite = onDocumentWritten(
  {
    region: "asia-northeast3",
    document: "diagnoses/{docId}",
    secrets: [CLIENT_EMAIL, PRIVATE_KEY, SHEET_ID],
  },
  async (event) => {
    logger.log("📸 새 진단 데이터 발생! Sheets로 반영 시작");

    const afterData = event.data?.after?.data();
    const docId = event.params.docId;

    if (!afterData) {
      logger.warn("❗ 데이터 없음. 삭제 이벤트일 수 있음");
      return;
    }

    try {
      // ✅ Google Sheets API 인증 (JWT 사용)
      const auth = new google.auth.JWT({
        email: CLIENT_EMAIL.value(),
        key: PRIVATE_KEY.value().replace(/\\n/g, "\n"),
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });

      const sheets = google.sheets({ version: "v4", auth });
      const sheetId = SHEET_ID.value();

      // ✅ 시트에 들어갈 한 줄 데이터 구성
      const row = [
        docId,
        afterData.createdAt || "",
        afterData.region || "",
        afterData.ok || false,
        afterData.observations?.[0] || "",
        afterData.observations?.[1] || "",
        afterData.observations?.[2] || "",
        afterData.possible_causes?.[0]?.name || "",
        afterData.possible_causes?.[0]?.probability || "",
        afterData.possible_causes?.[0]?.why || "",
        afterData.possible_causes?.[1]?.name || "",
        afterData.possible_causes?.[1]?.probability || "",
        afterData.possible_causes?.[1]?.why || "",
      ];

      logger.log("📄 작성할 Row 데이터:", row);

      // ✅ 시트에 한 줄 추가
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: "Sheet1!A1",
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: [row],
        },
      });

      logger.log("✅ Google Sheets에 실시간 백업 완료!");
    } catch (error) {
      logger.error("❌ 처리 중 오류 발생:", error.message);
      logger.error(error.stack);
    }
  }
);