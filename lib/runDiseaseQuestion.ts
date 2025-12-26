// /lib/runDiseaseQuestion.ts

type HistoryItem =
  | { role: "doctor"; text: string }
  | { role: "farmer"; qid: string; answer: string | string[] };

function getAnswer(history: HistoryItem[], qid: string): string | null {
  const h = history.find(x => x.role === "farmer" && x.qid === qid);
  if (!h) return null;
  return Array.isArray(h.answer) ? h.answer[0] : h.answer;
}

export function getNextDiseaseQuestion({
  parsed,
  history,
}: {
  parsed: any;
  history: HistoryItem[];
}) {
  const diseaseConfirm = getAnswer(history, "disease_confirm");

  if (!diseaseConfirm) {
    return {
      ok: true,
      phase: "QUESTION",
      primary_category: "DISEASE",
      question: {
        id: "disease_confirm",
        text: "잎이나 줄기에 눈에 띄는 병반이나 이상 증상이 보이십니까?",
        choices: [
          "반점·곰팡이처럼 번진다",
          "물러지거나 썩는 느낌이다",
          "잎이 누렇게 마르며 퍼진다",
          "뚜렷한 병반은 잘 모르겠다",
        ],
      },
      progress: { asked: 1, target: 4 },
    };
  }

  if (diseaseConfirm.includes("잘 모르")) {
    return {
      ok: true,
      phase: "QUESTION",
      primary_category: "ENVIRONMENT",
      question: {
        id: "env_branch",
        text: "병보다는 생육이나 환경 문제일 수 있습니다. 가장 가까운 상황을 선택해 주세요.",
        choices: [
          "잎이 과도하게 크고 진하다",
          "잎 색이 연해지고 생장이 둔하다",
          "전체적으로 균일하게 잘 자라고 있다",
          "잘 모르겠다",
        ],
      },
      progress: { asked: 2, target: 4 },
    };
  }

  const diseaseType = getAnswer(history, "disease_type");

  if (!diseaseType) {
    return {
      ok: true,
      phase: "QUESTION",
      primary_category: "DISEASE",
      question: {
        id: "disease_type",
        text: "증상 양상은 어떤 쪽에 더 가깝습니까?",
        choices: [
          "반점이 생기며 점점 번진다 (곰팡이)",
          "물러지거나 악취·점액 느낌 (세균)",
          "잎이 쭈글거리거나 기형 (바이러스)",
          "잘 모르겠다",
        ],
      },
      progress: { asked: 2, target: 4 },
    };
  }

  return {
    ok: true,
    phase: "FINAL",
    primary_category: "DISEASE",
    possible_causes: [
      {
        name: diseaseType.includes("곰팡이")
          ? "곰팡이성 병해 가능성"
          : diseaseType.includes("세균")
          ? "세균성 병해 가능성"
          : "바이러스성 병해 가능성",
        probability: 70,
        why: "사진 증상과 농가 응답을 종합할 때 전형적인 병해 진행 양상과 유사합니다.",
      },
    ],
    next_steps: [
      "증상이 심한 개체를 우선 분리해 관찰하세요.",
      "2~3일 뒤 병반 확대 여부를 다시 확인하세요.",
    ],
    do_not: [
      "병해 종류가 불확실한 상태에서 약제를 혼용하지 마세요.",
    ],
    need_119_if: [
      "하루 이틀 사이 급격히 확산될 때",
      "줄기까지 증상이 진행될 때",
    ],
  };
}