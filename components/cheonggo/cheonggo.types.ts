export type CheonggoAnswer = "yes" | "no" | "unknown";

export interface CheonggoOption {
  value: CheonggoAnswer;
  label: string;
}

export interface CheonggoQuestion {
  id: "suddenWilt" | "oneSideWilt" | "stemSlime" | "noRecovery";
  title: string;
  options: CheonggoOption[];
}