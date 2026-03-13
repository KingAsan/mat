const STORAGE_KEY = "mathsprint_best_scores_v1";

const DIFFICULTY_CONFIG = {
  easy: { basePoints: 10, timePerTask: 45, tolerance: 0.01 },
  medium: { basePoints: 20, timePerTask: 60, tolerance: 0.01 },
  hard: { basePoints: 30, timePerTask: 75, tolerance: 0.02 }
};

const state = {
  sessionActive: false,
  topic: "mixed",
  difficulty: "medium",
  totalTasks: 10,
  currentTaskIndex: 0,
  tasks: [],
  score: 0,
  streak: 0,
  correctCount: 0,
  wrongCount: 0,
  skippedCount: 0,
  hintsCount: 0,
  currentTaskMistakes: 0,
  currentTaskHintUsed: false,
  timeTotalSec: 0,
  timeLeftSec: 0,
  timerId: null,
  startedAt: null
};

const elements = {
  form: document.getElementById("session-form"),
  topic: document.getElementById("topic"),
  difficulty: document.getElementById("difficulty"),
  taskCount: document.getElementById("task-count"),
  trainer: document.getElementById("trainer"),
  summary: document.getElementById("summary"),
  taskIndex: document.getElementById("task-index"),
  taskTotal: document.getElementById("task-total"),
  score: document.getElementById("score"),
  streak: document.getElementById("streak"),
  timer: document.getElementById("timer"),
  progressBar: document.getElementById("progress-bar"),
  problemText: document.getElementById("problem-text"),
  answerInput: document.getElementById("answer-input"),
  checkBtn: document.getElementById("check-btn"),
  hintBtn: document.getElementById("hint-btn"),
  skipBtn: document.getElementById("skip-btn"),
  feedback: document.getElementById("feedback"),
  hintText: document.getElementById("hint-text"),
  correctCount: document.getElementById("correct-count"),
  wrongCount: document.getElementById("wrong-count"),
  skippedCount: document.getElementById("skipped-count"),
  hintsCount: document.getElementById("hints-count"),
  summaryScore: document.getElementById("summary-score"),
  summaryAccuracy: document.getElementById("summary-accuracy"),
  summaryBest: document.getElementById("summary-best"),
  summaryTime: document.getElementById("summary-time"),
  summaryNote: document.getElementById("summary-note"),
  restartBtn: document.getElementById("restart-btn")
};

setup();

function setup() {
  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    startSession();
  });

  elements.checkBtn.addEventListener("click", checkAnswer);
  elements.hintBtn.addEventListener("click", showHint);
  elements.skipBtn.addEventListener("click", skipTask);
  elements.restartBtn.addEventListener("click", startSession);
  elements.answerInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      checkAnswer();
    }
  });
}

function startSession() {
  clearTimer();

  const totalTasks = clampNumber(Number(elements.taskCount.value), 5, 50, 10);
  const topic = elements.topic.value;
  const difficulty = elements.difficulty.value;
  const difficultyCfg = DIFFICULTY_CONFIG[difficulty];

  state.sessionActive = true;
  state.topic = topic;
  state.difficulty = difficulty;
  state.totalTasks = totalTasks;
  state.currentTaskIndex = 0;
  state.tasks = Array.from({ length: totalTasks }, () => createTask(topic, difficulty));
  state.score = 0;
  state.streak = 0;
  state.correctCount = 0;
  state.wrongCount = 0;
  state.skippedCount = 0;
  state.hintsCount = 0;
  state.currentTaskMistakes = 0;
  state.currentTaskHintUsed = false;
  state.timeTotalSec = totalTasks * difficultyCfg.timePerTask;
  state.timeLeftSec = state.timeTotalSec;
  state.startedAt = Date.now();

  elements.taskTotal.textContent = String(totalTasks);
  setFeedback("", "");
  elements.hintText.textContent = "";
  elements.summary.classList.add("hidden");
  elements.trainer.classList.remove("hidden");

  updateSessionStats();
  renderCurrentTask();
  updateTimer();
  setActionButtonsDisabled(false);
  startTimer();
}

function startTimer() {
  state.timerId = setInterval(() => {
    if (!state.sessionActive) {
      return;
    }
    state.timeLeftSec -= 1;
    updateTimer();
    if (state.timeLeftSec <= 0) {
      state.timeLeftSec = 0;
      updateTimer();
      finishSession(true);
    }
  }, 1000);
}

function clearTimer() {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

function renderCurrentTask() {
  const task = state.tasks[state.currentTaskIndex];
  const progress = Math.round((state.currentTaskIndex / state.totalTasks) * 100);
  elements.progressBar.style.width = `${progress}%`;
  elements.taskIndex.textContent = String(state.currentTaskIndex + 1);
  elements.problemText.textContent = task.question;
  elements.answerInput.value = "";
  elements.answerInput.focus();
  state.currentTaskMistakes = 0;
  state.currentTaskHintUsed = false;
  setFeedback("", "");
  elements.hintText.textContent = "";
}

function checkAnswer() {
  if (!state.sessionActive) {
    return;
  }

  const rawInput = elements.answerInput.value.trim();
  if (!rawInput) {
    setFeedback("Введите ответ перед проверкой.", "error");
    return;
  }

  const userAnswer = parseAnswer(rawInput);
  if (!Number.isFinite(userAnswer)) {
    setFeedback("Формат ответа неверный. Пример: 12, 3/4, 2.5", "error");
    return;
  }

  const task = state.tasks[state.currentTaskIndex];
  const isCorrect = isCloseValue(userAnswer, task.answer, task.tolerance);

  if (!isCorrect) {
    state.currentTaskMistakes += 1;
    state.wrongCount += 1;
    state.streak = 0;
    updateSessionStats();
    setFeedback("Пока неверно. Попробуйте еще раз.", "error");
    return;
  }

  const earned = computePoints();
  state.score += earned;
  state.correctCount += 1;
  state.streak += 1;
  updateSessionStats();
  setFeedback(`Верно! +${earned} очков`, "success");

  setActionButtonsDisabled(true);
  setTimeout(() => {
    advanceTask();
    setActionButtonsDisabled(false);
  }, 750);
}

function showHint() {
  if (!state.sessionActive) {
    return;
  }
  const task = state.tasks[state.currentTaskIndex];
  if (!state.currentTaskHintUsed) {
    state.currentTaskHintUsed = true;
    state.hintsCount += 1;
    updateSessionStats();
  }
  elements.hintText.textContent = `Подсказка: ${task.hint}`;
}

function skipTask() {
  if (!state.sessionActive) {
    return;
  }
  const task = state.tasks[state.currentTaskIndex];
  state.skippedCount += 1;
  state.streak = 0;
  updateSessionStats();
  setFeedback(`Задача пропущена. Ответ: ${formatNumber(task.answer)}`, "error");
  setActionButtonsDisabled(true);
  setTimeout(() => {
    advanceTask();
    setActionButtonsDisabled(false);
  }, 900);
}

function advanceTask() {
  if (!state.sessionActive) {
    return;
  }
  state.currentTaskIndex += 1;
  if (state.currentTaskIndex >= state.totalTasks) {
    finishSession(false);
    return;
  }
  renderCurrentTask();
}

function finishSession(isTimeout) {
  if (!state.sessionActive) {
    return;
  }
  state.sessionActive = false;
  clearTimer();
  setActionButtonsDisabled(true);

  elements.progressBar.style.width = "100%";
  elements.trainer.classList.add("hidden");
  elements.summary.classList.remove("hidden");

  const elapsedSeconds = Math.max(0, state.timeTotalSec - state.timeLeftSec);
  const accuracy = Math.round((state.correctCount / state.totalTasks) * 100);
  const { bestScore, isNewRecord } = updateAndGetBestScore();

  elements.summaryScore.textContent = String(state.score);
  elements.summaryAccuracy.textContent = `${accuracy}%`;
  elements.summaryBest.textContent = String(bestScore);
  elements.summaryTime.textContent = formatDuration(elapsedSeconds);

  if (isTimeout) {
    elements.summaryNote.textContent = "Время вышло. Отличный повод повторить тренировку и улучшить результат.";
  } else if (isNewRecord) {
    elements.summaryNote.textContent = "Новый рекорд для выбранной темы и сложности. Отличная работа!";
  } else {
    elements.summaryNote.textContent = "Тренировка завершена. Сравните результат с лучшим и сделайте еще один подход.";
  }
}

function updateSessionStats() {
  elements.score.textContent = String(state.score);
  elements.streak.textContent = String(state.streak);
  elements.correctCount.textContent = String(state.correctCount);
  elements.wrongCount.textContent = String(state.wrongCount);
  elements.skippedCount.textContent = String(state.skippedCount);
  elements.hintsCount.textContent = String(state.hintsCount);
}

function updateTimer() {
  elements.timer.textContent = formatDuration(state.timeLeftSec);
}

function setActionButtonsDisabled(isDisabled) {
  elements.checkBtn.disabled = isDisabled;
  elements.hintBtn.disabled = isDisabled;
  elements.skipBtn.disabled = isDisabled;
  elements.answerInput.disabled = isDisabled;
}

function setFeedback(message, type) {
  elements.feedback.classList.remove("success", "error");
  if (type) {
    elements.feedback.classList.add(type);
  }
  elements.feedback.textContent = message;
}

function computePoints() {
  const cfg = DIFFICULTY_CONFIG[state.difficulty];
  const speedBonus = Math.ceil((state.timeLeftSec / Math.max(1, state.timeTotalSec)) * 6);
  const streakBonus = Math.min(state.streak, 8) * 2;
  const mistakePenalty = state.currentTaskMistakes * 3;
  const hintPenalty = state.currentTaskHintUsed ? Math.round(cfg.basePoints * 0.35) : 0;
  return Math.max(2, cfg.basePoints + speedBonus + streakBonus - mistakePenalty - hintPenalty);
}

function updateAndGetBestScore() {
  const key = `${state.topic}_${state.difficulty}`;
  const allBest = loadBestScores();
  const currentBest = allBest[key] || 0;
  const isNewRecord = state.score > currentBest;
  const bestScore = isNewRecord ? state.score : currentBest;
  allBest[key] = bestScore;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(allBest));
  return { bestScore, isNewRecord };
}

function loadBestScores() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const data = JSON.parse(raw);
    return typeof data === "object" && data !== null ? data : {};
  } catch (error) {
    return {};
  }
}

function createTask(selectedTopic, difficulty) {
  const topic = selectedTopic === "mixed" ? pickOne(["arithmetic", "fractions", "equations", "percentages"]) : selectedTopic;
  const tolerance = DIFFICULTY_CONFIG[difficulty].tolerance;
  let task;

  if (topic === "arithmetic") {
    task = generateArithmetic(difficulty);
  } else if (topic === "fractions") {
    task = generateFractions(difficulty);
  } else if (topic === "equations") {
    task = generateEquation(difficulty);
  } else {
    task = generatePercentage(difficulty);
  }

  return {
    ...task,
    topic,
    tolerance: task.tolerance ?? tolerance
  };
}

function generateArithmetic(difficulty) {
  if (difficulty === "easy") {
    const op = pickOne(["+", "-"]);
    let a = randomInt(6, 40);
    let b = randomInt(2, 25);
    if (op === "-" && b > a) {
      [a, b] = [b, a];
    }
    return {
      question: `${a} ${op} ${b} = ?`,
      answer: op === "+" ? a + b : a - b,
      hint: op === "+" ? "Сложите оба числа поразрядно." : "Из большего числа вычтите меньшее."
    };
  }

  if (difficulty === "medium") {
    const op = pickOne(["+", "-", "*", "/"]);
    if (op === "*") {
      const a = randomInt(4, 18);
      const b = randomInt(3, 15);
      return { question: `${a} * ${b} = ?`, answer: a * b, hint: "Разбейте множитель на удобные части, если нужно." };
    }
    if (op === "/") {
      const b = randomInt(2, 14);
      const answer = randomInt(2, 15);
      const a = b * answer;
      return { question: `${a} / ${b} = ?`, answer, hint: "Подберите число, которое при умножении на делитель дает делимое." };
    }

    let a = randomInt(20, 130);
    let b = randomInt(10, 90);
    if (op === "-" && b > a) {
      [a, b] = [b, a];
    }
    return {
      question: `${a} ${op} ${b} = ?`,
      answer: op === "+" ? a + b : a - b,
      hint: "Сначала работайте с десятками, затем с единицами."
    };
  }

  const pattern = pickOne(["sum_mul", "mul_diff", "brackets"]);
  if (pattern === "sum_mul") {
    const a = randomInt(8, 28);
    const b = randomInt(3, 12);
    const c = randomInt(2, 9);
    return {
      question: `${a} + ${b} * ${c} = ?`,
      answer: a + b * c,
      hint: "Сначала выполните умножение, потом сложение."
    };
  }
  if (pattern === "mul_diff") {
    const a = randomInt(5, 16);
    const b = randomInt(4, 14);
    const c = randomInt(2, 11);
    const d = randomInt(2, 9);
    return {
      question: `${a} * ${b} - ${c} * ${d} = ?`,
      answer: a * b - c * d,
      hint: "Вычислите оба произведения отдельно, затем вычтите."
    };
  }
  const a = randomInt(3, 16);
  const b = randomInt(2, 15);
  const c = randomInt(2, 10);
  return {
    question: `(${a} + ${b}) * ${c} = ?`,
    answer: (a + b) * c,
    hint: "Сначала посчитайте выражение в скобках."
  };
}

function generateFractions(difficulty) {
  if (difficulty === "easy") {
    const den = randomInt(3, 12);
    const n1 = randomInt(1, den - 1);
    let n2 = randomInt(1, den - 1);
    const op = pickOne(["+", "-"]);
    if (op === "-" && n2 > n1) {
      n2 = randomInt(1, n1);
    }
    const numerator = op === "+" ? n1 + n2 : n1 - n2;
    const answer = numerator / den;
    return {
      question: `${n1}/${den} ${op} ${n2}/${den} = ?`,
      answer,
      hint: "Знаменатели одинаковые, работайте только с числителями."
    };
  }

  if (difficulty === "medium") {
    let d1 = randomInt(2, 10);
    let d2 = randomInt(2, 10);
    while (d2 === d1) {
      d2 = randomInt(2, 10);
    }
    let n1 = randomInt(1, d1 - 1);
    let n2 = randomInt(1, d2 - 1);
    const op = pickOne(["+", "-"]);
    if (op === "-" && n1 / d1 < n2 / d2) {
      [n1, n2] = [n2, n1];
      [d1, d2] = [d2, d1];
    }
    const numerator = op === "+" ? n1 * d2 + n2 * d1 : n1 * d2 - n2 * d1;
    const denominator = d1 * d2;
    const reduced = reduceFraction(numerator, denominator);
    return {
      question: `${n1}/${d1} ${op} ${n2}/${d2} = ?`,
      answer: numerator / denominator,
      hint: `Приведите к общему знаменателю (${denominator}), затем сократите до ${reduced.num}/${reduced.den}.`
    };
  }

  const op = pickOne(["*", "/"]);
  const n1 = randomInt(1, 12);
  const d1 = randomInt(2, 14);
  const n2 = randomInt(1, 12);
  const d2 = randomInt(2, 14);

  if (op === "*") {
    const numerator = n1 * n2;
    const denominator = d1 * d2;
    const reduced = reduceFraction(numerator, denominator);
    return {
      question: `${n1}/${d1} * ${n2}/${d2} = ?`,
      answer: numerator / denominator,
      hint: `Перемножьте числители и знаменатели, затем сократите (${reduced.num}/${reduced.den}).`
    };
  }

  const numerator = n1 * d2;
  const denominator = d1 * n2;
  const reduced = reduceFraction(numerator, denominator);
  return {
    question: `${n1}/${d1} / ${n2}/${d2} = ?`,
    answer: numerator / denominator,
    hint: `Замените деление на умножение на обратную дробь. Ответ после сокращения: ${reduced.num}/${reduced.den}.`
  };
}

function generateEquation(difficulty) {
  if (difficulty === "easy") {
    const mode = pickOne(["plus", "minus"]);
    if (mode === "plus") {
      const x = randomInt(1, 30);
      const a = randomInt(2, 20);
      const b = x + a;
      return {
        question: `x + ${a} = ${b}`,
        answer: x,
        hint: "Перенесите свободный член вправо: x = b - a."
      };
    }
    const x = randomInt(1, 30);
    const a = randomInt(2, 16);
    const b = x - a;
    return {
      question: `x - ${a} = ${b}`,
      answer: x,
      hint: "Добавьте одно и то же число к обеим частям уравнения."
    };
  }

  if (difficulty === "medium") {
    const x = randomInt(-18, 22);
    const a = randomInt(2, 12) * pickOne([1, -1]);
    const b = randomInt(-20, 20);
    const c = a * x + b;
    return {
      question: `${a}x ${formatSigned(b)} = ${c}`,
      answer: x,
      hint: "Сначала перенесите свободный член, затем разделите на коэффициент при x."
    };
  }

  const mode = pickOne(["brackets", "division"]);
  if (mode === "brackets") {
    const x = randomInt(-12, 18);
    const a = randomInt(2, 9);
    const b = randomInt(-8, 10);
    const c = a * (x + b);
    return {
      question: `${a}(x ${formatSigned(b)}) = ${c}`,
      answer: x,
      hint: "Разделите обе части на коэффициент перед скобкой, затем выразите x."
    };
  }

  const a = randomInt(2, 9);
  const q = randomInt(-8, 12);
  const x = q * a;
  const b = randomInt(-9, 9);
  const c = q + b;
  return {
    question: `x / ${a} ${formatSigned(b)} = ${c}`,
    answer: x,
    hint: "Сначала перенесите свободный член, потом умножьте обе части на знаменатель."
  };
}

function generatePercentage(difficulty) {
  if (difficulty === "easy") {
    const percent = pickOne([5, 10, 15, 20, 25, 30, 40, 50]);
    const number = randomInt(20, 400);
    return {
      question: `Найдите ${percent}% от ${number}.`,
      answer: (number * percent) / 100,
      hint: "Переведите процент в дробь и умножьте: number * percent / 100."
    };
  }

  if (difficulty === "medium") {
    const total = randomInt(40, 300);
    const percent = pickOne([10, 20, 25, 30, 40, 50, 60, 75]);
    const part = (total * percent) / 100;
    return {
      question: `Какой процент составляет ${formatNumber(part)} от ${total}?`,
      answer: percent,
      hint: "Используйте формулу: (часть / целое) * 100."
    };
  }

  const base = randomInt(60, 500);
  const percent = randomInt(5, 40);
  const mode = pickOne(["increase", "decrease"]);
  if (mode === "increase") {
    return {
      question: `Увеличьте ${base} на ${percent}%.`,
      answer: base * (1 + percent / 100),
      hint: "Увеличение на p% = base * (1 + p/100)."
    };
  }
  return {
    question: `Уменьшите ${base} на ${percent}%.`,
    answer: base * (1 - percent / 100),
    hint: "Уменьшение на p% = base * (1 - p/100)."
  };
}

function parseAnswer(inputValue) {
  const cleaned = inputValue.replace(",", ".").replace("%", "").trim();
  if (cleaned.includes("/")) {
    const parts = cleaned.split("/").map((part) => part.trim());
    if (parts.length !== 2) {
      return Number.NaN;
    }
    const [numText, denText] = parts;
    const num = Number(numText);
    const den = Number(denText);
    if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) {
      return Number.NaN;
    }
    return num / den;
  }
  return Number(cleaned);
}

function isCloseValue(userValue, expectedValue, tolerance = 0.01) {
  const absoluteDelta = Math.abs(userValue - expectedValue);
  const relativeDelta = tolerance * Math.max(1, Math.abs(expectedValue));
  return absoluteDelta <= tolerance || absoluteDelta <= relativeDelta;
}

function reduceFraction(num, den) {
  const divisor = gcd(Math.abs(num), Math.abs(den));
  return { num: num / divisor, den: den / divisor };
}

function gcd(a, b) {
  let x = a;
  let y = b;
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

function formatSigned(value) {
  return value >= 0 ? `+ ${value}` : `- ${Math.abs(value)}`;
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function formatNumber(value) {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return Number(value.toFixed(2)).toString();
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickOne(arr) {
  return arr[randomInt(0, arr.length - 1)];
}

function clampNumber(value, min, max, fallback) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}
