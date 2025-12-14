// engines/potato.engine.ts
// ✅ 감자 전용 엔진 – 더뎅이병·저장병 “확정 금지 + 질문 모드”

type EngineResult =
  | { blocked: true; message: string; reason: string }
  | { blocked: false; message: string };

const normalize = (s: string) => s.replace(/\s+/g, "").toLowerCase();
const hasAny = (text: string, keywords: string[]) =>
  keywords.some(k => normalize(text).includes(normalize(k)));

export function potatoEngine(
  rawResult: string,
  cropName?: string
): EngineResult {
  if (!cropName || !cropName.includes("감자")) {
    return { blocked: false, message: rawResult };
  }

  const text = rawResult ?? "";

  /**
   * 🔥 감자 “사진만으로 확정 불가” 병해 시그널
   */
  const POTATO_HIGH_RISK_SIGNALS = [
    "검은반점",
    "갈색반점",
    "표면병반",
    "거칠",
    "껍질병반",
    "저장중",
    "부패",
    "세균성",
    "썩음",
    "더뎅이",
    "흑색",
    "저장병",
    "토양병"
  ];

  const suspectPotatoUncertain = hasAny(text, POTATO_HIGH_RISK_SIGNALS);

  if (suspectPotatoUncertain) {
    return {
      blocked: true,
      reason: "POTATO_DISEASE_UNCERTAIN",
      message: `📋 AI 진단 결과 (중요 안내)

현재 사진만으로는
감자 병해를 **확정할 수 없습니다.**

이 증상은 다음 병해에서
서로 매우 유사하게 나타납니다.

- 더뎅이병 (토양성 생리·세균성)
- 흑색썩음병
- 저장 중 발생한 부패성 병해
- 표피 손상 + 2차 감염

❗ 이 단계에서 병명을 단정하거나
❗ 농약을 사용하는 것은 효과가 없거나
❗ 오히려 저장 중 피해를 키울 수 있습니다.

━━━━━━━━━━━━━━
🧠 정확한 판단을 위한 질문
━━━━━━━━━━━━━━
1) 병반이 **표면만 거친가요**, 아니면 **속까지 파고드나요?**
2) 냄새(악취)가 나나요?
3) 저장 중에 더 심해지나요, 수확 직후부터 있었나요?
4) 같은 밭 감자에서 반복적으로 나타나나요?

━━━━━━━━━━━━━━
📸 추가 촬영 요청 (필수)
━━━━━━━━━━━━━━
1️⃣ 병반 근접 확대 사진  
2️⃣ 감자 절단 단면 사진  
3️⃣ 동일 밭의 다른 감자 사진  

━━━━━━━━━━━━━━
⛔ 현재 단계에서는
━━━━━━━━━━━━━━
- ❌ 농약 추천을 하지 않습니다
- ❌ 방제 처방을 하지 않습니다
- ❌ 병명 확정을 하지 않습니다

👉 위 정보가 확보되면  
‘더뎅이병 여부’를 포함해  
**실제 도움이 되는 관리 방향**을 안내할 수 있습니다.

※ 농가 피해 방지를 위한 보호 단계입니다.`
    };
  }

  return { blocked: false, message: rawResult };
}