/** =========================
 * HistoryItem 최소 타입 (베이스캠프 고정)
 * ========================= */
type HistoryItem =
  | {
      role: "farmer";
      qid: string;
      answer: string | string[];
      kind?: "CHOICE" | "FREE_TEXT";
    }
  | {
      role: "doctor";
      kind?: string;
      text?: string;
    };

/** =========================
 * farmer answer 안전 접근
 * ========================= */
function getFarmerAnswer(
  history: HistoryItem[],
  qid: string
): string | null {
  const h = history.find(
    (x): x is Extract<HistoryItem, { role: "farmer" }> =>
      x.role === "farmer" && x.qid === qid
  );

  if (!h) return null;
  return Array.isArray(h.answer) ? h.answer[0] : h.answer;
}

/** =========================
 * ENVIRONMENT 질문 분기
 * ========================= */
export function getNextEnvironmentQuestion({
  parsed,
  history,
}: {
  parsed: any;
  history: HistoryItem[];
}) {
  const envConfirm = getFarmerAnswer(history, "ENV_CONFIRM");

  if (!envConfirm) {
    return {
      id: "ENV_CONFIRM",
      kind: "CHOICE",
      text: "최근 날씨나 환경 변화가 있었나요?",
      choices: [
        "갑작스러운 기온 변화",
        "강한 햇빛이나 한파",
        "비가 잦거나 습도가 높았음",
        "특별한 변화는 없었음",
      ],
    };
  }

  if (envConfirm !== "특별한 변화는 없었음") {
    const envDetail = getFarmerAnswer(history, "ENV_DETAIL");

    if (!envDetail) {
      return {
        id: "ENV_DETAIL",
        kind: "FREE_TEXT",
        text: "기억나는 환경 변화가 있다면 간단히 적어주세요.",
      };
    }
  }

  return null;
}