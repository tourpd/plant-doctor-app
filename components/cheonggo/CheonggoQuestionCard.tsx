"use client";

import { CheonggoQuestion } from "./cheonggo.types";

type Props = {
  question: CheonggoQuestion;
  onSelect: (value: "yes" | "no" | "unknown") => void;
};

export default function CheonggoQuestionCard({ question, onSelect }: Props) {
  return (
    <div className="p-4 border rounded-lg space-y-4">
      <h2 className="text-lg font-semibold">{question.title}</h2>

      <div className="space-y-2">
        {question.options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onSelect(opt.value)}
            className="w-full text-left px-4 py-2 border rounded hover:bg-gray-50"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}