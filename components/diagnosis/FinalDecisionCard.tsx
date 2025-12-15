"use client";

type RiskLevel = "LOW" | "WARNING" | "CRITICAL";

type FinalDecisionCardProps = {
  riskLevel: RiskLevel;
  title: string;
  summary: string;
  reasons: string[];
  actions: string[];
};

const riskStyle = {
  LOW: {
    bg: "bg-green-50",
    border: "border-green-500",
    badge: "bg-green-600",
    label: "안정 단계",
    icon: "✅",
  },
  WARNING: {
    bg: "bg-yellow-50",
    border: "border-yellow-500",
    badge: "bg-yellow-500",
    label: "주의 필요",
    icon: "⚠️",
  },
  CRITICAL: {
    bg: "bg-red-50",
    border: "border-red-600",
    badge: "bg-red-600",
    label: "즉시 대응",
    icon: "🚨",
  },
};

export default function FinalDecisionCard({
  riskLevel,
  title,
  summary,
  reasons,
  actions,
}: FinalDecisionCardProps) {
  const style = riskStyle[riskLevel];

  return (
    <div
      className={`border-4 ${style.border} ${style.bg} rounded-xl p-5 space-y-4`}
    >
      {/* 위험 단계 배지 */}
      <div className="flex items-center gap-2">
        <span
          className={`text-white text-sm px-3 py-1 rounded-full ${style.badge}`}
        >
          {style.icon} {style.label}
        </span>
      </div>

      {/* 제목 */}
      <h2 className="text-xl font-bold">{title}</h2>

      {/* 요약 */}
      <p className="leading-relaxed text-gray-800 whitespace-pre-line">
        {summary}
      </p>

      {/* 판단 근거 */}
      {reasons?.length > 0 && (
        <div>
          <h3 className="font-semibold mb-1">🔍 판단 근거</h3>
          <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
            {reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 지금 할 일 */}
      {actions?.length > 0 && (
        <div>
          <h3 className="font-semibold mb-1">✅ 지금 할 일</h3>
          <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
            {actions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 도움 받기 버튼 */}
      <div className="pt-3 border-t space-y-2">
        <button
          onClick={() =>
            window.open("https://map.naver.com/v5/search/농업기술센터")
          }
          className="w-full bg-green-600 text-white font-bold py-3 rounded-lg"
        >
          📞 인근 농업기술센터 찾기
        </button>

        <button
          onClick={() =>
            window.open("https://map.naver.com/v5/search/농약방")
          }
          className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg"
        >
          📍 인근 농약방 보기
        </button>

        <button
          onClick={() =>
            window.open(
              "https://docs.google.com/forms/d/e/1FAIpQLSdKgcwl_B-10yU0gi4oareM4iajMPND6JtGIZEwjbwPbnQBEg/viewform",
              "_blank"
            )
          }
          className="w-full bg-red-600 text-white font-extrabold py-3 rounded-lg"
        >
          🚨 농사119 출동 요청
        </button>

        <p className="text-xs text-gray-500 mt-2">
          * AI 진단은 참고용이며, 정확한 판단은 현장 전문가 상담이
          도움이 됩니다.
        </p>
      </div>
    </div>
  );
}
