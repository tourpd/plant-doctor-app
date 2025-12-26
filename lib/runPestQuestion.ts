// /lib/runPestQuestion.ts

type HistoryItem =
  | { role: "doctor"; text: string }
  | { role: "farmer"; qid: string; answer: string | string[] };

/**
 * ✅ farmer 타입으로 명확히 좁히는 getAnswer
 */
function getAnswer(
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

export function getNextPestQuestion({
  parsed,
  history,
}: {
  parsed: any;
  history: HistoryItem[];
}) {
  /* ===============================
     1️⃣ 해충 실존 여부 (가장 중요)
  =============================== */
  const pestConfirm = getAnswer(history, "pest_confirm");

  if (!pestConfirm) {
    return {
      ok: true,
      phase: "QUESTION",
      primary_category: "PEST",
      question: {
        id: "pest_confirm",
        text: "사진에서 실제 벌레가 보이십니까?",
        choices: [
          "예, 벌레가 분명히 보입니다",
          "벌레는 잘 안 보이고 반점·변색만 있습니다",
          "벌레인지 병인지 잘 모르겠습니다",
        ],
      },
      progress: { asked: 1, target: 4 },
    };
  }

  /* ===============================
     2️⃣ 벌레가 안 보이는 경우 → 해충 탈락
     (질병/환경 트리로 넘길 신호)
  =============================== */
  if (
    pestConfirm.includes("안 보이") ||
    pestConfirm.includes("모르")
  ) {
    return {
      ok: true,
      phase: "QUESTION",
      primary_category: "NON_PEST",
      branch_hint: "DISEASE_OR_ENV",
      question: {
        id: "non_pest_branch",
        text: "해충보다는 다른 원인이 의심됩니다. 가장 가까운 상황을 선택해 주세요.",
        choices: [
          "잎에 반점이나 곰팡이처럼 번진다",
          "잎 색이 연해지거나 진해진다",
          "생육은 좋은데 잎만 과도하게 크다",
          "특별한 이상은 잘 모르겠다",
        ],
      },
      progress: { asked: 2, target: 4 },
    };
  }

  /* ===============================
     3️⃣ 해충 계열 분기
  =============================== */
  const pestFamily = getAnswer(history, "pest_family");

  if (!pestFamily) {
    return {
      ok: true,
      phase: "QUESTION",
      primary_category: "PEST",
      question: {
        id: "pest_family",
        text: "벌레의 모습이나 피해 양상은 어떤 쪽에 가깝습니까?",
        choices: [
          "잎 뒷면에 작은 벌레가 떼로 붙어 있다 (진딧물)",
          "잎이 은색·회색으로 변하고 긁힌 흔적 (총채벌레)",
          "잎이 오그라들고 미세한 점 피해 (응애)",
          "유충이나 나방 애벌레가 보인다",
          "잘 모르겠다",
        ],
      },
      progress: { asked: 2, target: 4 },
    };
  }

  /* ===============================
     4️⃣ 확산 양상 확인
  =============================== */
  const pestSpread = getAnswer(history, "pest_spread");

  if (!pestSpread) {
    return {
      ok: true,
      phase: "QUESTION",
      primary_category: "PEST",
      question: {
        id: "pest_spread",
        text: "현재 피해 확산 양상은 어떻습니까?",
        choices: [
          "특정 포기에서만 나타난다",
          "여러 포기로 빠르게 번지고 있다",
          "하우스 한쪽에서 시작됐다",
          "잘 모르겠다",
        ],
      },
      progress: { asked: 3, target: 4 },
    };
  }

  /* ===============================
     5️⃣ FINAL — 해충 계열 확정
  =============================== */
  const familyName =
    pestFamily.includes("진딧")
      ? "진딧물 계열 해충 가능성"
      : pestFamily.includes("총채")
      ? "총채벌레 계열 해충 가능성"
      : pestFamily.includes("응애")
      ? "응애 계열 해충 가능성"
      : "해충 피해 가능성";

  return {
    ok: true,
    phase: "FINAL",
    primary_category: "PEST",
    possible_causes: [
      {
        name: familyName,
        probability: 70,
        why: "사진 관찰과 농가 응답을 종합할 때 해당 해충 계열의 전형적인 피해 양상과 일치합니다.",
      },
    ],
    must_check: [
      "잎 뒷면에서 해충 개체 수가 계속 증가하는지",
      "새순과 연약한 부위에서 피해가 심해지는지",
    ],
    do_not: [
      "해충 계열이 확정되지 않은 상태에서 강한 약제를 반복 사용하지 마세요.",
    ],
    next_steps: [
      "피해가 심한 포기부터 분리해 관찰하세요.",
      "2~3일 간 개체 수 변화가 줄어드는지 확인하세요.",
    ],
    need_119_if: [
      "하루 이틀 사이 피해가 급격히 확산될 때",
      "새순 생장이 멈추고 전체 생육이 급격히 떨어질 때",
    ],
  };
}