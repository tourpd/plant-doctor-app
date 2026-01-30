import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

export const logDiagnosisUpdate = onDocumentUpdated(
  "diagnoses/{diagnosisId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    // 🔒 로그 변경으로 인한 무한 루프 방지
    if (before.logs?.length !== after.logs?.length) {
      return;
    }

    const logs = after.logs || [];

    if (before.admin?.status !== after.admin?.status) {
      logs.push({
        type: "ADMIN_STATUS_CHANGE",
        actor: after.admin?.updatedBy || "admin",
        detail: `${before.admin?.status} → ${after.admin?.status}`,
        at: admin.firestore.FieldValue.serverTimestamp(),
      });

      await event.data?.after.ref.update({ logs });
    }
  }
);
