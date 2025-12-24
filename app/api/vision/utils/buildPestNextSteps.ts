// app/api/vision/utils/buildPestNextSteps.ts

type PestContext = {
  primaryName: string;
  confidence?: number;
  isGreenhouse?: boolean; // 하우스 여부
};

export function buildPestNextSteps({
  primaryName,
  confidence = 0,
  isGreenhouse,
}: PestContext) {
  const steps: string[] = [];

  // 1️⃣ 현재 상황 인식 (과장·단정 없음)
  steps.push(
    "사진상에서 정확한 종까지는 단정하기 어렵지만, 해충 개체가 다수 관찰됩니다. 가장 많이 보이는 포기부터 상태를 확인하세요."
  );

  // 2️⃣ 농가에서 실제로 많이 하는 초기 대응 방식
  steps.push(
    "이 단계에서는 해충이 더 번지지 않도록 개체 수 증가를 먼저 멈춰두고, 2~3일간 변화를 지켜보는 농가가 많습니다."
  );

  // 3️⃣ 방제 요령 (현장 톤, 광고 아님)
  steps.push(
    "이 단계에서는 강한 약부터 쓰기보다는, 농가에서 부담이 적은 친환경·유기농 자재로 먼저 밀도를 낮춰보는 경우가 많습니다."
  );

  steps.push(
    "예를 들어 일부 농가에서는 싹쓰리충 같은 친환경 자재로 1회 시험 살포 후, 2~3일간 개체 수 변화를 보고 다음 대응을 결정합니다."
  );

  // 4️⃣ 재배 환경별 확인 포인트
  if (isGreenhouse === true) {
    steps.push(
      "하우스 재배라면 환기 상태와 습도가 과하지 않았는지 함께 점검해 보세요."
    );
  } else if (isGreenhouse === false) {
    steps.push(
      "노지 재배라면 최근 비나 기온 변화 이후 주변 포기까지 해충이 번졌는지 확인해 보세요."
    );
  } else {
    steps.push(
      "하우스인지 노지인지에 따라 대응 방법이 달라지므로, 재배 환경부터 정리해 두는 것이 좋습니다."
    );
  }

  // 5️⃣ 관찰 기준 명확화
  steps.push(
    "2~3일 뒤에도 잎 뒷면이나 새순에서 해충 개체 수가 줄지 않는다면, 대응 단계를 다시 조정할 필요가 있습니다."
  );

  // 6️⃣ 신뢰도 낮을 때만 추가 안내
  if (confidence < 80) {
    steps.push(
      "해충 형태가 애매하다면 잎 뒷면이나 줄기 가까운 부위를 다시 확인하면 판단에 도움이 됩니다."
    );
  }

  return steps;
}