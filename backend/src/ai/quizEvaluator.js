function normalizeAnswer(value) {
  return (value || "").trim().toLowerCase();
}

export function evaluateQuizAnswers({ quiz, answers }) {
  const answerMap = new Map((answers || []).map((item) => [item.questionId, item.answer]));

  const detailed = quiz.map((question) => {
    const userAnswer = answerMap.get(question.id) || "";
    const isCorrect = normalizeAnswer(userAnswer) === normalizeAnswer(question.correctOption);

    return {
      questionId: question.id,
      question: question.question,
      selectedAnswer: userAnswer,
      correctAnswer: question.correctOption,
      isCorrect,
      explanation: question.explanation
    };
  });

  const correctCount = detailed.filter((item) => item.isCorrect).length;

  return {
    total: quiz.length,
    correct: correctCount,
    scorePercent: Math.round((correctCount / Math.max(1, quiz.length)) * 100),
    details: detailed
  };
}
