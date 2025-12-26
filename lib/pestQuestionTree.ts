export const PEST_QUESTION_TREE = {
  start: "pest_q1",
  nodes: {
    pest_q1: {
      text: "잎이나 줄기에서 벌레가 실제로 보이나요?",
      choices: {
        yes_visible: "눈으로 보이는 벌레가 있다",
        no_visible: "벌레는 안 보이는데 흔적만 있다",
        not_sure: "잘 모르겠다",
      },
      next: {
        yes_visible: "pest_q2",
        no_visible: "pest_q5",
        not_sure: "pest_q2",
      },
    },

    pest_q2: {
      text: "해충이 가장 많이 보이는 위치는 어디인가요?",
      choices: {
        leaf_back: "잎 뒷면",
        new_leaf: "새순/어린잎",
        flower: "꽃이나 열매",
        stem: "줄기",
      },
      next: {
        leaf_back: "pest_q3",
        new_leaf: "pest_q3",
        flower: "pest_q4",
        stem: "pest_q4",
      },
    },

    pest_q3: {
      text: "해충의 크기와 움직임은 어떤가요?",
      choices: {
        very_small_many: "아주 작고 많이 모여 있다",
        small_fast: "작고 빠르게 움직인다",
        medium_slow: "눈에 보이고 움직임이 느리다",
      },
      end_hint: true,
    },

    pest_q4: {
      text: "잎이나 꽃에 이런 흔적이 보이나요?",
      choices: {
        silver_spot: "은색 반점",
        hole: "구멍",
        sticky: "끈적한 분비물",
        none: "특별한 흔적 없음",
      },
      end_hint: true,
    },

    pest_q5: {
      text: "벌레는 안 보이지만 잎 상태는 어떤가요?",
      choices: {
        curl: "잎이 말린다",
        yellow: "잎이 누렇다",
        spot: "점·얼룩",
        normal: "정상처럼 보인다",
      },
      end_state: {
        curl: "PEST_LIKELY",
        yellow: "DISEASE_OR_NUTRIENT",
        spot: "DISEASE_OR_NUTRIENT",
        normal: "HEALTHY_OR_EARLY",
      },
    },
  },
};