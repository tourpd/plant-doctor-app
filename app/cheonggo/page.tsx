import CheonggoQuestionFlow from "@/components/cheonggo/CheonggoQuestionFlow";

export default function CheonggoPage() {
  return (
    <main className="max-w-xl mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">🌶 고추 시들음 진단</h1>
      <CheonggoQuestionFlow />
    </main>
  );
}