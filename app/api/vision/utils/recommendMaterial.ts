// utils/recommendMaterial.ts

import { insectKeywords } from './insectKeywords';
import { diseaseKeywords } from './diseaseKeywords';
import { sunburnKeywords } from './sunburnKeywords';

export type RecommendedMaterial = {
  title: string;
  description?: string;
  howToUse?: string;
};

export type MaterialRecommendation = {
  usageGuide: string;
  materials?: RecommendedMaterial[];
};

export function getRecommendation(judgement: string): MaterialRecommendation | null {
  // ✅ 해충 조건
  if (insectKeywords.some(keyword => judgement.includes(keyword))) {
    return {
      usageGuide: `
초기 발생 시에는 잎 뒷면에 집중하여 살충제를 분무하세요.  
• 작용 계열: 신경계 차단제 / 탈피억제제  
• 살포 시기: 오전 10시 이전 또는 오후 5시 이후  
• 처리 방법: 3~5일 간격 2회 이상 반복, 작물 하부 집중
`,
      materials: [
        {
          title: '친환경 싹쓰리충',
          description: '식물로 만든 천연 살충제',
          howToUse: '3일 간격으로 2회 분무, 잎 뒷면 집중',
        },
        {
          title: '유기농 싹쓰리충 골드',
          description: '약제 저항성 해충에 효과적',
          howToUse: '5일 간격으로 1회 처리',
        },
      ],
    };
  }

  // ✅ 병해 조건
  if (diseaseKeywords.some(keyword => judgement.includes(keyword))) {
    return {
      usageGuide: `
병해 발생 시엔 예방적 살균처리가 중요합니다.  
• 작용 계열: 보호 살균제 (접촉형) 또는 침투성 살균제  
• 사용 시기: 병반 발생 전 또는 초기에  
• 처리 방법: 5~7일 간격 2~3회 살포, 엽면 전체 처리
`,
      materials: [
        {
          title: '유기농자재 멸규니',
          description: '곰팡이성 병원균 억제에 효과적인 유기농 살균제',
          howToUse: '7일 간격 2회 분무, 잎 표면 전체',
        },
      ],
    };
  }

  // ✅ 환경장해 조건
  if (sunburnKeywords.some(keyword => judgement.includes(keyword))) {
    return {
      usageGuide: `
고온기 직사광선에 의한 일소 피해 예방이 필요합니다.  
• 예방 시기: 고온기 전날 저녁 또는 아침  
• 처리 방법: 잎과 과실 표면에 보호제 엽면 살포
`,
      materials: [
        {
          title: '블로킹칼',
          description: '고온 스트레스 및 강한 일조로 인한 과실 손상 예방',
          howToUse: '고온기 전후 1회, 오전 중 살포 권장',
        },
      ],
    };
  }

  // 기본값
  return null;
}