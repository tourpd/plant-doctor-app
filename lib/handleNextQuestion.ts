async function handleNextQuestion(selectedAnswer: string | string[]) {
  if (!currentQuestion) return;

  try {
    setLoading(true);

    // 1️⃣ history 누적
    const newHistory = [
      ...history,
      {
        role: "farmer",
        qid: currentQuestion.id,
        answer: selectedAnswer,
      },
    ];

    // 2️⃣ FormData 구성
    const formData = new FormData();

    formData.append("action", "answer");
    formData.append("qid", currentQuestion.id);
    formData.append(
      "answer",
      typeof selectedAnswer === "string"
        ? selectedAnswer
        : JSON.stringify(selectedAnswer)
    );

    formData.append("history", JSON.stringify(newHistory));

    if (imageFile) {
      formData.append("image", imageFile);
    }

    if (crop) formData.append("crop", crop);
    if (region) formData.append("region", region);

    // 3️⃣ 서버 요청
    const res = await fetch("/api/vision", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (!data || !data.ok) {
      throw new Error("진단 요청 실패");
    }

    // 4️⃣ 공통: history 업데이트
    setHistory(newHistory);

    // 5️⃣ QUESTION → 다음 질문
    if (data.phase === "QUESTION") {
      setCurrentQuestion(data.question);
      setResult(null); // 이전 결과 제거
      setProgress(data.progress ?? null);
      return;
    }

    // 6️⃣ FINAL → 진단 종료
    if (data.phase === "FINAL") {
      setCurrentQuestion(null);
      setResult(data);
      setProgress(null);
      return;
    }
  } catch (err) {
    console.error("handleNextQuestion error:", err);
    alert("진단 중 오류가 발생했습니다. 다시 시도해 주세요.");
  } finally {
    setLoading(false);
  }
}