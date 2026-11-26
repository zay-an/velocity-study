import type { Question } from "./types";

/**
 * Built-in evaluation deck: 8 questions spanning Computer Science and
 * General Knowledge across three difficulty tiers (3 Easy, 3 Medium, 2 Hard).
 */
export const DEMO_QUESTIONS: readonly Question[] = [
  {
    id: "cs-html",
    category: "Computer Science",
    difficulty: "Easy",
    prompt: "What does HTML stand for?",
    options: [
      "HyperText Markup Language",
      "High Transfer Machine Language",
      "Hyperlink and Text Management Logic",
      "Home Tool Markup Language",
    ],
    correctIndex: 0,
    explanation: "HTML is the HyperText Markup Language that structures web pages.",
  },
  {
    id: "gk-planet",
    category: "General Knowledge",
    difficulty: "Easy",
    prompt: "Which planet is known as the Red Planet?",
    options: ["Venus", "Jupiter", "Mars", "Mercury"],
    correctIndex: 2,
    explanation: "Iron oxide on its surface gives Mars its reddish appearance.",
  },
  {
    id: "cs-binary",
    category: "Computer Science",
    difficulty: "Easy",
    prompt: "What is the binary number 1010 in decimal?",
    options: ["8", "10", "12", "5"],
    correctIndex: 1,
    explanation: "1010₂ = 8 + 0 + 2 + 0 = 10.",
  },
  {
    id: "cs-stack",
    category: "Computer Science",
    difficulty: "Medium",
    prompt: "Which data structure follows Last-In, First-Out (LIFO) order?",
    options: ["Queue", "Linked List", "Heap", "Stack"],
    correctIndex: 3,
    explanation: "A stack pops the most recently pushed element first.",
  },
  {
    id: "gk-element",
    category: "General Knowledge",
    difficulty: "Medium",
    prompt: "What is the chemical symbol for gold?",
    options: ["Go", "Gd", "Au", "Ag"],
    correctIndex: 2,
    explanation: "Au comes from the Latin word for gold, aurum.",
  },
  {
    id: "gk-bones",
    category: "General Knowledge",
    difficulty: "Medium",
    prompt: "How many bones are in the adult human body?",
    options: ["186", "206", "226", "212"],
    correctIndex: 1,
    explanation: "Adults have 206 bones; infants start with around 270.",
  },
  {
    id: "cs-binary-search",
    category: "Computer Science",
    difficulty: "Hard",
    prompt: "What is the worst-case time complexity of binary search on a sorted array?",
    options: ["O(n)", "O(n log n)", "O(1)", "O(log n)"],
    correctIndex: 3,
    explanation: "Each comparison halves the search space, giving O(log n).",
  },
  {
    id: "cs-http-status",
    category: "Computer Science",
    difficulty: "Hard",
    prompt: "Which HTTP status code means “Too Many Requests”?",
    options: ["429", "403", "503", "418"],
    correctIndex: 0,
    explanation: "429 signals rate limiting; 503 is Service Unavailable.",
  },
];
