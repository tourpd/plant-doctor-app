/**
 * CONTROL_SETS_INSECT
 * - AI는 해충명만 판단
 * - 방제 순서·농약·자재는 이 파일이 정답
 * - 대한민국 PLS 기준 + 현장 농민 기준
 */

export type InsectControlSetKey =
  | "I01_THRIPS"
  | "I02_APHID";

export interface InsectControlSet {
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
  ecoPlan: {
    material: string;
    purpose: string;
  }[];
  cautions: string[];
  nextGuide: string;
}

export const CONTROL_SETS_INSECT: Record<
  InsectControlSetKey,
  InsectControlSet
> = {
  /* =====================================================
     I01. 딸기 총채벌레
  ===================================================== */
  I01_THRIPS: {
    title: "딸기 총채벌레",
    situation:
      "꽃·어린 과실에 피해가 집중되며 고온·건조 조건에서 급속 증가",

    diagnosisSummary: [
      "과실 표면의 은백색 반점과 긁힌 흔적이 관찰됩니다.",
      "꽃 주변에서 피해가 시작되어 과실 기형으로 이어지는 경우가 많습니다.",
      "총채벌레는 초기 대응이 늦으면 수확량 손실이 급격히 커집니다."
    ],

    immediateAction: [
      "피해 과실과 꽃 주변을 우선적으로 확인하십시오.",
      "블루·옐로 트랩을 설치하여 밀도를 즉시 점검하십시오.",
      "하우스 내부 건조 구간을 줄이도록 관수·습도 관리를 병행하십시오."
    ],

    treatmentPlan: [
      {
        step: "1차 방제 (즉시)",
        pesticide: "스피노사드",
        company: "코르테바",
        purpose: "총채벌레 성충 및 약충 신속 밀도 저감"
      },
      {
        step: "2차 방제 (5~7일 후)",
        pesticide: "어드마이어",
        company: "바이엘",
        purpose: "흡즙 해충 잔존 개체 제거"
      },
      {
        step: "3차 방제 (밀도 지속 시)",
        pesticide: "모벤토",
        company: "바이엘",
        purpose: "약제 계통 교체를 통한 저항성 억제"
      }
    ],

    ecoPlan: [
      {
        material: "싹쓰리충",
        purpose: "총채벌레 서식 환경 악화 및 개체수 증가 억제"
      }
    ],

    cautions: [
      "꽃이 많은 시기에는 약제 살포 시간과 약해에 주의하십시오.",
      "동일 계통 약제를 반복 사용하지 마십시오.",
      "트랩 밀도 변화로 방제 효과를 반드시 확인하십시오."
    ],

    nextGuide:
      "총채벌레는 재발이 잦으므로 트랩 기반 상시 모니터링 체계를 유지하십시오."
  },

  /* =====================================================
     I02. 딸기 진딧물
  ===================================================== */
  I02_APHID: {
    title: "딸기 진딧물",
    situation:
      "잎 뒷면과 신초에서 군집 발생하며 바이러스 매개 위험 존재",

    diagnosisSummary: [
      "잎 뒷면에 작은 흡즙성 해충이 군집으로 관찰됩니다.",
      "잎 말림, 생육 저하, 끈적한 분비물이 동반되는 경우가 많습니다.",
      "진딧물은 직접 피해보다 바이러스 매개가 더 큰 문제입니다."
    ],

    immediateAction: [
      "신초와 잎 뒷면을 집중적으로 점검하십시오.",
      "심하게 발생한 잎은 즉시 제거하십시오.",
      "하우스 내부 질소 과다 상태를 점검하십시오."
    ],

    treatmentPlan: [
      {
        step: "1차 방제 (즉시)",
        pesticide: "모스피란",
        company: "니폰소다",
        purpose: "진딧물 성충·약충 동시 방제"
      },
      {
        step: "2차 방제 (5~7일 후)",
        pesticide: "어드마이어",
        company: "바이엘",
        purpose: "잔존 개체 제거 및 재발 억제"
      }
    ],

    ecoPlan: [
      {
        material: "싹쓰리충",
        purpose: "진딧물 서식 환경 악화 및 증식 억제"
      }
    ],

    cautions: [
      "질소질 비료 과다는 진딧물 급증 원인이 됩니다.",
      "약제 살포 후 잎 말림 증상 변화를 관찰하십시오.",
      "개화기에는 약제 선택과 살포 시간에 주의하십시오."
    ],

    nextGuide:
      "바이러스 의심 증상이 보이면 추가 방제를 고려하십시오."
  }
};