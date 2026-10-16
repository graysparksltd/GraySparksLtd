// Checks a drafted offer message against the compliance rules in CLAUDE.md.
// Returns a list of problems; an empty list means the draft passes.

export const MAX_LENGTH = 1500;

const RULES = [
  { name: "dash", re: /[\u2014\u2013]/, why: "contains an em or en dash" },
  { name: "link", re: /https?:\/\/|www\.|\b[\w-]+\.(com|co\.uk|uk|net|org|io|ltd)\b/i, why: "contains a link or web address" },
  { name: "email", re: /[\w.+-]+@[\w-]+\.[\w.]+/, why: "contains an email address" },
  { name: "phone", re: /(?:\+44|\b0)[\d\s()-]{9,}\d/, why: "contains a phone number" },
  { name: "price", re: /[\u00a3$\u20ac]\s?\d|\b\d+\s?(?:pounds|quid|p\/h|per hour|an hour)\b|\bhourly rate\b|\/\s?(?:hr|hour)\b/i, why: "states a price or rate" },
  { name: "budget", re: /\bbudget\b/i, why: "mentions the customer's budget" },
  { name: "salesy", re: /free (?:measure|quote|estimate|visit)|no[- ]obligation/i, why: "uses a banned salesy phrase" },
  { name: "off-platform", re: /\b(?:whatsapp|bank transfer|cash in hand|paypal)\b/i, why: "refers to off-platform contact or payment" },
  { name: "grading", re: /you(?:'re| are) (?:absolutely )?right (?:that|to)|clearly thought|right way|already know the critical/i, why: "grades or approves the customer" },
  { name: "self-certify", re: /my strength|what i do best|where i(?:'m| am) strongest|genuinely good at/i, why: "self-certifies" },
  { name: "rather-than", re: /\brather than\b/i, why: "uses 'rather than' as a putdown" },
  { name: "rivals", re: /someone who (?:has|hasn't)|anyone pricing|cheaper builder|furniture company/i, why: "ranks against other trades" },
];

export function checkDraft(text) {
  const problems = [];
  const message = String(text ?? "");
  if (!message.trim()) return ["empty draft"];
  if (message.length >= MAX_LENGTH) problems.push(`too long (${message.length} characters, limit ${MAX_LENGTH - 1})`);
  for (const rule of RULES) {
    if (rule.re.test(message)) problems.push(`${rule.name}: ${rule.why}`);
  }
  return problems;
}
