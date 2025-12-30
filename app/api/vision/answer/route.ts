// app/api/vision/answer/route.ts
import { NextRequest, NextResponse } from "next/server";

type FinalResponse = {
  ok: true;
  phase: "FINAL";
  uploaded_image: string;
  crop_guess: { name: string; confidence: number };
  observations: string[];
  possible_causes: { name: string; probability: number; why: string }[];
  final_judgement: string;
  actions: {
    doNow: string[];
    doNot: string[];
    mustCheck: string[];
  };
  similar_images: {
    title: string;
    image_url: string;
    source?: string;
  }[];
  links: {
    kaftv: string;
    emergency119: string;
  };
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      answer,       // STEP1 선택지
      crop,
      province,
      city,
      imageName,
    } = body;

    /* =========================
       간단하지만 “결정적” 분기
    ========================= */
    let final: FinalResponse;

    if (answer === "노랗게 변함") {
      final = {
        ok: true,
        phase: "FINAL",
        uploaded_image: imageName,
        crop_guess: { name: crop || "고추", confidence: 0.8 },
        observations: [
          "잎 전체가 연한 노란색으로 변색",
          "생육 속도가 눈에 띄게 저하됨",
        ],
        possible_causes: [
          {
            name: "바이러스 감염",
            probability: 60,
            why: "노란 반점과 잎 변형이 전형적인 바이러스 증상",
          },
          {
            name: "영양 결핍",
            probability: 25,
            why: "질소 결핍과 유사한 황화 증상",
          },
          {
            name: "해충 피해",
            probability: 15,
            why: "해충 흡즙 후 2차 증상 가능성",
          },
        ],
        final_judgement:
          "현재 증상은 바이러스성 병해 가능성이 높습니다.\n확산 위험이 있으므로 즉각적인 대응이 필요합니다.",
        actions: {
          doNow: [
            "의심 개체를 즉시 제거 또는 격리",
            "주변 작물 증상 여부 점검",
          ],
          doNot: [
            "감염 의심 개체를 다른 밭으로 이동 금지",
            "무분별한 약제 살포 금지",
          ],
          mustCheck: [
            "인근 포장 동일 증상 여부",
            "매개 해충 존재 여부",
          ],
        },
        similar_images: [
          {
            title: "바이러스 감염 잎",
            image_url: "/images/virus_leaf_1.jpg",
            source: "Wikimedia",
          },
          {
            title: "황화 증상 사례",
            image_url: "/images/virus_leaf_2.jpg",
            source: "Wikimedia",
          },
          {
            title: "초기 병징",
            image_url: "/images/virus_leaf_3.jpg",
            source: "Wikimedia",
          },
        ],
        links: {
          kaftv: "https://www.youtube.com/@한국농수산TV",
          emergency119: "https://plant-doctor-app.vercel.app/119",
        },
      };
    } else {
      final = {
        ok: true,
        phase: "FINAL",
        uploaded_image: imageName,
        crop_guess: { name: crop || "미상", confidence: 0.55 },
        observations: ["뚜렷한 병징은 제한적"],
        possible_causes: [
          {
            name: "경미한 생리장해",
            probability: 70,
            why: "환경 스트레스 가능성",
          },
        ],
        final_judgement:
          "현재로서는 심각한 병해 가능성은 낮아 보입니다.\n경과 관찰이 필요합니다.",
        actions: {
          doNow: ["수분·시비 상태 점검"],
          doNot: ["불필요한 방제 작업"],
          mustCheck: ["2~3일 후 변화 여부"],
        },
        similar_images: [],
        links: {
          kaftv: "https://www.youtube.com/@한국농수산TV",
          emergency119: "https://plant-doctor-app.vercel.app/119",
        },
      };
    }

    return NextResponse.json(final);
  } catch {
    return NextResponse.json({
      ok: false,
      error: "STEP2 처리 중 오류",
    });
  }
}