import type { ControlSetKey } from "./controlSets";

export const DISEASE_TO_SET: Record<string, ControlSetKey> = {
  "흰가루병": "F01_POWDERY_MILDEW",
  "잿빛곰팡이병": "F02_GRAY_MOLD",
  "탄저병": "F03_ANTHRACNOSE",

  // 필요 시 확장
  // "세균성점무늬병": "B01_BACTERIAL",
  // "응애": "I01_INSECT",
};