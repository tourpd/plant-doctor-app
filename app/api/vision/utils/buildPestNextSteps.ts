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

  steps.push(
    "사진상에서 정확한 종까지 단정하기는 어렵지만, 해충 개체가 관찰됩니다."
  );

  steps.push(
    "이 단계에서는 해충이 더 늘어나는지, 줄어드는지를 먼저 판단하는 것이 중요합니다."
  );

  steps.push(
    "농가에서는 이 시점에 부담이 적은 친환경·유기농 자재로 먼저 개체 수를 눌러보고, 2~3일간 변화를 지켜보는 경우가 많습니다."
  );

  steps.push(
    "예를 들어 일부 농가에서는 싹쓰리충 같은 친환경 자재로 1회 시험 대응 후, 해충 밀도 변화를 기준으로 다음 판단을 이어갑니다."
  );

  steps.push(
    "2~3일 뒤에도 잎 뒷면이나 새순에서 해충 개체 수가 줄지 않으면, 대응 단계를 다시 조정할 필요가 있습니다."
  );

  return steps;
}