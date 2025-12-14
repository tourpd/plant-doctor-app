// engines/strawberry.engine.ts
export const strawberryEngine = {
  process(rawResult: string) {
    if (rawResult.includes("잿빛곰팡이")) {
      return rawResult + "\n\n[딸기 잿빛곰팡이 관리 안내 추가]";
    }
    return rawResult;
  },
};