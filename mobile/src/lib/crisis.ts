export const CRISIS_KEYWORDS = [
  "want to die",
  "kill myself",
  "end my life",
  "suicide",
  "can't go on",
  "cant go on",
  "hurt myself",
  "self harm",
  "self-harm",
  "no reason to live",
];

export function detectCrisis(text: string): boolean {
  const lower = text.toLowerCase();
  return CRISIS_KEYWORDS.some((kw) => lower.includes(kw));
}

export const CRISIS_HELPLINES = [
  { name: "MANAS", phone: "14416 / 1800891446", hours: "24/7" },
  { name: "KIRAN Rehabilitation Helpline", phone: "18005990019", hours: "24/7" },
  { name: "NIMHANS", phone: "08046110007", hours: "24/7" },
];
