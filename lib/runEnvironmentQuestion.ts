// /lib/runEnvironmentQuestion.ts

type HistoryItem =
  | { role: "doctor"; text: string }
  | { role: "farmer"; qid: string; answer: string | string[] };

function getAnswer(history: HistoryItem[], qid: string): string | null {
  const h = history.find(x => x.role === "farmer" && x.qid === qid);
  if (!h) return null;
  return Array.isArray(h.answer) ? h.answer[0] : h.answer;
}

export function getNextEnvironmentQuestion({
  parsed,
  history,
}: {
  parsed: any;
  history: HistoryItem[];
}) {
  /* ===============================
     1️⃣ 환경·영양 증상 확인
  =============================== */
  const env = getAnswer(history, "env_confirm");

  if (!env) {
    return {
      ok: true,
      phase: "QUESTION",
      primary_category: "ENVIRONMENT",
      question: {
        id: "env_confirm",
        text: "환경·영양과 관련된 증상 중 가장 가까운 것은 무엇입니까?",
        choices: [
          "잎이 연해지거나 황화된다",
          "잎이 진해지고 웃자람이 심하다",
          "수분 스트레스처럼 축 처진다",
          "잘 모르겠다",
        ],
      },
      progress: { asked: 1, target: 2 },
    };
  }

  /* ===============================
     2️⃣ 원인 분기 (키워드 기반)
  =============================== */

  // 질소 결핍 / 영양 부족
  if (env.includes("연해") || env.includes("황화")) {
    return {
      ok: true,
      phase: "FINAL",
      primary_category: "ENVIRONMENT",
      possible_causes: [
        {
          name: "영양 부족(질소 결핍) 가능성",
          probability: 70,
          why: "잎색이 연해지고 황화되는 양상은 영양 부족 시 흔히 나타납니다.",
        },
      ],
      must_check: [
        "최근 비료 투입 간격",
        "잎 전체의 색 변화 여부",
      ],
      do_not: [
        "급하게 고농도 비료를 추가 투입하지 마세요.",
      ],
      next_steps: [
        "기존 비료 투입 이력을 먼저 정리하세요.",
        "3~4일간 색 변화 추이를 관찰하세요.",
      ],
      need_119_if: [
        "황화가 빠르게 위쪽 잎까지 확산될 때",
      ],
    };
  }

  // 질소 과다 / 웃자람
  if (env.includes("진해") || env.includes("웃자람")) {
    return {
      ok: true,
      phase: "FINAL",
      primary_category: "ENVIRONMENT",
      possible_causes: [
        {
          name: "질소 과다(웃자람) 가능성",
          probability: 70,
          why: "잎색이 진하고 잎만 커지는 양상은 질소 과다 시 흔합니다.",
        },
      ],
      must_check: [
        "최근 질소 비료 투입량",
        "줄기 연약화 여부",
      ],
      do_not: [
        "추가 비료 투입은 즉시 중단하세요.",
      ],
      next_steps: [
        "관수와 시비를 잠시 안정화하세요.",
        "웃자람이 멈추는지 3~5일 관찰하세요.",
      ],
      need_119_if: [
        "줄기가 꺾이거나 생육 균형이 급격히 무너질 때",
      ],
    };
  }

  // 수분 스트레스
  if (env.includes("축") || env.includes("처진")) {
    return {
      ok: true,
      phase: "FINAL",
      primary_category: "ENVIRONMENT",
      possible_causes: [
        {
          name: "수분 스트레스 가능성",
          probability: 65,
          why: "잎이 축 처지는 모습은 수분 공급 불균형 시 자주 나타납니다.",
        },
      ],
      must_check: [
        "토양 수분 상태",
        "최근 기온·일사 변화",
      ],
      do_not: [
        "한 번에 많은 물을 급하게 주지 마세요.",
      ],
      next_steps: [
        "관수 주기를 일정하게 조절하세요.",
        "회복 여부를 1~2일 관찰하세요.",
      ],
      need_119_if: [
        "관수 후에도 회복 없이 계속 처질 때",
      ],
    };
  }

  /* ===============================
     3️⃣ 애매한 경우 (보호)
  =============================== */
  return {
    ok: true,
    phase: "FINAL",
    primary_category: "ENVIRONMENT",
    possible_causes: [
      {
        name: "환경·영양 스트레스 가능성",
        probability: 60,
        why: "뚜렷한 병해·해충 흔적 없이 생육 반응 위주의 변화입니다.",
      },
    ],
    next_steps: [
      "관수·시비를 일단 안정화하세요.",
      "며칠간 변화 양상을 관찰하세요.",
    ],
    need_119_if: [
      "원인 없이 급격히 상태가 악화될 때",
    ],
  };
}