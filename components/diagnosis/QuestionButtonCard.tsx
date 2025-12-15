"use client";

type Option = {
  value: string;
  label: string;
};

type QuestionButtonCardProps = {
  question: string;
  options?: Option[];
  onSelect: (value: string) => void;
};

/**
 * 농민용 질문 카드
 * - 글 안 씀
 * - 버튼만 누름
 * - 현장 즉답 가능
 */
export default function QuestionButtonCard({
  question,
  options = [
    { value: "yes", label: "있다" },
    { value: "no", label: "없다" },
    { value: "unknown", label: "잘 모르겠다" },
  ],
  onSelect,
}: QuestionButtonCardProps) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: 420,
        background: "#0d0d0d",
        border: "2px solid #00ff88",
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
      }}
    >
      {/* 질문 */}
      <div
        style={{
          color: "#00ff88",
          fontSize: 18,
          fontWeight: 800,
          marginBottom: 12,
          lineHeight: 1.4,
        }}
      >
        {question}
      </div>

      {/* 버튼 옵션 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onSelect(opt.value)}
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 12,
              border: "2px solid #00ff88",
              background: "#111",
              color: "#00ff88",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}