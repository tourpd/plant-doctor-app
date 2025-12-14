import { pepperEngine } from "./pepper.engine";
import { strawberryEngine } from "./strawberry.engine";

export function getCropEngine(cropName: string) {
  const name = cropName.replace(/\s+/g, "").toLowerCase();

  if (name.includes("고추")) return pepperEngine;
  if (name.includes("딸기")) return strawberryEngine;

  return {
    process: (result: string) => result,
  };
}