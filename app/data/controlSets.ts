/**
 * CONTROL_SETS
 * - AI는 병명만 판단
 * - 처방·농약·순서는 이 파일만이 정답
 * - 대한민국 PLS 기준 + 현장 농민 기준
 */

export type ControlSetKey =
  | "F01_POWDERY_MILDEW"
  | "F02_GRAY_MOLD"
  | "F03_ANTHRACNOSE";

export interface ControlSet {
  title: string;
  situation: string;
  diagnosisSummary: string[];
  immediateAction: string[];
  treatmentPlan: {
    step: string;
    pesticide: string;
    company: string;
    purpose: string;
  }[];
  cautions: string[];
  nextGuide: string;
}

export const CONTROL_SETS: Record<ControlSetKey, ControlSet> = {
  /* =====================================================
     F01. 딸기 흰가루병
  ===================================================== */
  F01_POWDERY_MILDEW: {
    title: "딸기 흰가루병",
    situation: "잎에서 시작되어 과실로 진행된 상태",

    diagnosisSummary: [
      "과실 표면에 흰 가루 형태의 증상이 관찰됩니다.",
      "이는 잎에서 먼저 발생한 흰가루병이 과실로 확산된 전형적인 진행 양상입니다.",
      "현재 단계에서는 병 확산 차단이 가장 중요합니다."
    ],

    immediateAction: [
      "감염된 과실은 즉시 수확하여 제거하십시오.",
      "병든 과실을 하우스 내부에 방치하지 마십시오.",
      "환기를 강화하여 습도가 오래 머물지 않도록 관리하십시오."
    ],

    treatmentPlan: [
      {
        step: "1차 방제 (즉시)",
        pesticide: "톱신엠",
        company: "팜한농",
        purpose: "이미 발생한 병반의 확산 억제"
      },
      {
        step: "2차 방제 (5~7일 후)",
        pesticide: "사파이어",
        company: "동방아그로",
        purpose: "계통 교체를 통한 재발 억제"
      },
      {
        step: "3차 방제 (상황 지속 시)",
        pesticide: "카브리오에이",
        company: "BASF",
        purpose: "장기 방제 안정화"
      }
    ],

    cautions: [
      "동일 계통 약제를 연속 사용하지 마십시오.",
      "수확 전 안전사용기준을 반드시 확인하십시오.",
      "약제 살포 후 약해 발생 여부를 관찰하십시오."
    ],

    nextGuide:
      "방제 후에도 확산이 멈추지 않으면 환경 관리와 방제 간격을 재점검하십시오."
  },

  /* =====================================================
     F02. 딸기 잿빛곰팡이병 (Botrytis cinerea)
  ===================================================== */
  F02_GRAY_MOLD: {
    title: "딸기 잿빛곰팡이병",
    situation: "꽃·과실에서 발생하며 고습 조건에서 급속 확산되는 상태",

    diagnosisSummary: [
      "과실 또는 꽃 부위에 회색 곰팡이 형태의 병반이 관찰됩니다.",
      "저온·다습한 시설 환경에서 가장 흔히 발생하는 딸기 대표 곰팡이병입니다.",
      "꽃에서 감염된 뒤 과실 비대 과정에서 증상이 나타나는 경우가 많습니다."
    ],

    immediateAction: [
      "병든 과실과 꽃은 즉시 제거하여 외부로 반출하십시오.",
      "하우스 내부 결로 발생 여부를 점검하십시오.",
      "환기 횟수를 늘려 습도가 장시간 유지되지 않도록 관리하십시오."
    ],

    treatmentPlan: [
      {
        step: "1차 방제 (즉시)",
        pesticide: "스위치",
        company: "신젠타",
        purpose: "현재 발생한 잿빛곰팡이병 확산 억제"
      },
      {
        step: "2차 방제 (5~7일 후)",
        pesticide: "로브랄",
        company: "바이엘",
        purpose: "계통 교체를 통한 재감염 및 저항성 억제"
      },
      {
        step: "3차 방제 (지속 발생 시)",
        pesticide: "칸타스",
        company: "BASF",
        purpose: "장기 확산 차단 및 방제 안정화"
      }
    ],

    cautions: [
      "동일 계통 약제를 연속 살포하지 마십시오.",
      "개화기 약제 살포 시 착과 및 약해에 주의하십시오.",
      "수확 전 안전사용기준을 반드시 확인하십시오."
    ],

    nextGuide:
      "반복 발생 시 환경 관리와 방제 주기 재설계가 필요합니다."
  },

  /* =====================================================
     F03. 딸기 탄저병 (Colletotrichum spp.)
  ===================================================== */
  F03_ANTHRACNOSE: {
    title: "딸기 탄저병",
    situation: "고온기 이후 잎·관부·과실에 병반이 확산되는 상태",

    diagnosisSummary: [
      "과실에 움푹 들어간 흑갈색 병반이 형성되는 것이 특징입니다.",
      "주로 고온·다습한 조건에서 급격히 확산되며, 묘 단계 감염이 원인이 되는 경우가 많습니다.",
      "한 번 발생하면 포장 전체로 빠르게 번질 수 있는 고위험 병해입니다."
    ],

    immediateAction: [
      "병든 주와 과실은 즉시 제거하여 재배지 밖으로 반출하십시오.",
      "관부 부위 물 고임이 발생하지 않도록 배수를 점검하십시오.",
      "의심 주 주변 작업을 최소화하여 전염을 차단하십시오."
    ],

    treatmentPlan: [
      {
        step: "1차 방제 (즉시)",
        pesticide: "카브리오에이",
        company: "BASF",
        purpose: "탄저병 초기 병반 확산 차단"
      },
      {
        step: "2차 방제 (5~7일 후)",
        pesticide: "벨리스",
        company: "BASF",
        purpose: "계통 교체를 통한 재발 억제"
      },
      {
        step: "3차 방제 (지속 발생 시)",
        pesticide: "스코어",
        company: "신젠타",
        purpose: "관부·잎 감염 억제 및 장기 방제 안정화"
      }
    ],

    cautions: [
      "탄저병은 관부 감염 시 회복이 어렵습니다.",
      "묘 구입 단계에서 무병묘 사용이 가장 중요합니다.",
      "고온기에는 방제 간격을 짧게 가져가십시오."
    ],

    nextGuide:
      "반복 발생 포장은 다음 작기 재배 계획을 재검토하는 것이 바람직합니다."
  }
};