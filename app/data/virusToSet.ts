/**
 * controlSetsVirusPepper.ts
 * - 고추 바이러스 병 전용 CONTROL_SET
 * - 치료 불가 원칙
 * - 제거 + 확산 차단 + 매개충 통제만 제시
 */

export type VirusControlSetKey =
  | "V01_TSWV"          // 고추반점위조바이러스 (치명형)
  | "V02_PMMoV"         // 고추모자이크바이러스
  | "V03_CMV"           // 오이모자이크바이러스
  | "V04_PYV"           // 황화·위축계
  | "V99_VIRUS_SUSPECT";

export interface VirusControlSet {
  title: string;
  severity: "CRITICAL" | "WARNING";
  treatable: false;
  diagnosisSummary: string[];
  immediateAction: string[];
  spreadControl: string[];
  vectorControl: string[];
  nextGuide: string;
}

export const CONTROL_SETS_VIRUS_PEPPER: Record<
  VirusControlSetKey,
  VirusControlSet
> = {
  /* ===============================
     V01. 고추 반점위조바이러스 (TSWV)
     🔴 치명형
  =============================== */
  V01_TSWV: {
    title: "고추 반점위조바이러스 (TSWV)",
    severity: "CRITICAL",
    treatable: false,

    diagnosisSummary: [
      "잎에 갈색·황색 원형 반점이 나타납니다.",
      "생장점 고사, 과실 기형이 동반됩니다.",
      "치료가 불가능한 바이러스 병입니다."
    ],

    immediateAction: [
      "감염 개체는 즉시 뽑아 외부 반출 후 폐기하십시오.",
      "절대 재배지 내 방치하지 마십시오."
    ],

    spreadControl: [
      "주변 건전주 정밀 예찰을 즉시 시작하십시오.",
      "작업 도구·장갑을 철저히 소독하십시오."
    ],

    vectorControl: [
      "총채벌레 방제를 즉시 병행하십시오.",
      "끈끈이트랩으로 밀도를 지속 확인하십시오."
    ],

    nextGuide:
      "추가 확산이 확인되면 해당 구역 재배 중단을 검토하십시오."
  },

  /* ===============================
     V02. 고추 모자이크바이러스
     🟡 확산형
  =============================== */
  V02_PMMoV: {
    title: "고추 모자이크바이러스",
    severity: "WARNING",
    treatable: false,

    diagnosisSummary: [
      "잎에 모자이크 무늬와 생육 저하가 나타납니다.",
      "접촉·작업 도구로 쉽게 전염됩니다."
    ],

    immediateAction: [
      "증상 개체는 조기에 제거하십시오.",
      "손·도구 소독을 철저히 하십시오."
    ],

    spreadControl: [
      "작업 동선을 분리하십시오.",
      "의심주 접촉 후 다른 포기로 이동 금지."
    ],

    vectorControl: [
      "진딧물 방제를 병행하십시오."
    ],

    nextGuide:
      "초기 차단이 가장 중요하며 방치 시 전면 확산됩니다."
  },

  /* ===============================
     V03. 오이 모자이크바이러스
  =============================== */
  V03_CMV: {
    title: "오이 모자이크바이러스",
    severity: "WARNING",
    treatable: false,

    diagnosisSummary: [
      "잎 왜곡과 모자이크 증상이 혼재합니다.",
      "여러 작물 간 교차 감염이 가능합니다."
    ],

    immediateAction: [
      "의심 개체는 즉시 격리 또는 제거하십시오."
    ],

    spreadControl: [
      "인접 작물 상태를 함께 점검하십시오."
    ],

    vectorControl: [
      "진딧물 방제를 반드시 병행하십시오."
    ],

    nextGuide:
      "혼합 감염 시 피해가 급격히 커질 수 있습니다."
  },

  /* ===============================
     V04. 황화·위축계 바이러스
  =============================== */
  V04_PYV: {
    title: "고추 황화·위축 바이러스",
    severity: "WARNING",
    treatable: false,

    diagnosisSummary: [
      "잎이 노랗게 변하고 생육이 멈춥니다.",
      "회복되지 않습니다."
    ],

    immediateAction: [
      "회복 기대 없이 제거를 권장합니다."
    ],

    spreadControl: [
      "확산 전 조기 차단이 핵심입니다."
    ],

    vectorControl: [
      "진딧물·가루이 방제 병행."
    ],

    nextGuide:
      "확산 속도가 느려도 누적 피해가 큽니다."
  },

  /* ===============================
     V99. 바이러스 의심
  =============================== */
  V99_VIRUS_SUSPECT: {
    title: "바이러스 의심",
    severity: "WARNING",
    treatable: false,

    diagnosisSummary: [
      "전형적 병해와 다른 증상이 관찰됩니다."
    ],

    immediateAction: [
      "의심주를 격리하십시오."
    ],

    spreadControl: [
      "추가 사진과 예찰이 필요합니다."
    ],

    vectorControl: [
      "기본 해충 방제를 유지하십시오."
    ],

    nextGuide:
      "추가 진단 후 바이러스 여부를 확정하십시오."
  }
};