"use client";

type DecisionLevel = "CRITICAL" | "WARNING" | "LOW";

type Props = {
  level: DecisionLevel;
  message: string;
  reasons?: string[];
};

const LEVEL_STYLE = {
  CRITICAL: {
    bg: "bg-red-50",
    border: "border-red-400",
    title: "🚨 청고병 강력 의심",
  },
  WARNING: {
    bg: "bg-orange-50",
    border: "border-orange-400",
    title: "⚠️ 청고병 의심",
  },
  LOW: {
    bg: "bg-green-50",
    border: "border-green-400",
    title: "✅ 청고병 가능성 낮음",
  },
};

export default function CheonggoDiagnosisResult({
  level,
  message,
  reasons = [],
}: Props) {
  const style = LEVEL_STYLE[level];

  return (
    <div className={`p-4 border-l-4 ${style.border} ${style.bg} rounded-md space-y-4`}>
      <h2 className="text-lg font-bold">{style.title}</h2>

      <div className="text-sm whitespace-pre-line">{message}</div>

      {reasons.length > 0 && (
        <ul className="list-disc pl-5 text-sm space-y-1">
          {reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}

      <div className="bg-white p-3 rounded border text-sm">
        <p className="font-semibold">👉 다음 단계</p>
        <ul className="list-disc pl-5 mt-1">
          <li>📍 인근 농업기술센터 문의</li>
          <li>🏪 인근 농약방 상담</li>
        </ul>
      </div>
    </div>
  );
}