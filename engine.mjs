const WORDS = new Map(Object.entries({
  about: 900, accept: 420, actually: 760, after: 980, again: 900, already: 650,
  always: 920, amazing: 420, and: 1200, app: 900, are: 1200, around: 850,
  because: 1150, before: 980, build: 850, can: 1200, complete: 760,
  completion: 580, create: 1000, correction: 580, creative: 520, dashboard: 500,
  day: 1100, design: 950, different: 950, do: 1200, edit: 920, every: 1050,
  example: 820, feel: 970, first: 1100, for: 1300, from: 1250, get: 1200,
  going: 1050, good: 1150, great: 850, have: 1300, hello: 720, help: 1150,
  hey: 720, how: 1200, idea: 1000, implement: 780, in: 1300, input: 780,
  is: 1400, it: 1400, just: 1100, know: 1150, language: 850, like: 1300,
  local: 800, make: 1250, more: 1300, my: 1300, need: 1200, never: 900,
  new: 1250, no: 1200, now: 1200, of: 1400, on: 1400, one: 1300,
  only: 1200, or: 1300, plan: 1000, please: 1050, project: 950,
  quick: 850, really: 1100, ready: 900, right: 1200, say: 1000, see: 1200,
  should: 1150, simple: 950, so: 1400, some: 1200, start: 1000, system: 850,
  text: 1000, that: 1400, the: 1600, their: 1200, there: 1300, they: 1300,
  think: 1100, this: 1500, through: 900, time: 1300, to: 1700,
  typo: 800, understand: 700, use: 1300, very: 1150, want: 1300,
  way: 1200, we: 1400, what: 1300, when: 1200, with: 1400, word: 1050,
  would: 1200, you: 1600, your: 1500, typing: 850, today: 850,
  tomorrow: 700, testing: 700, suggestion: 700, suggestions: 800,
  writing: 900, writer: 750, keyboard: 850, laptop: 850, everywhere: 700
}));

const CORRECTIONS = new Map([
  ["im", { replacement: "I’m", confidence: 0.99, reason: "Common apostrophe correction" }],
  ["dont", { replacement: "don’t", confidence: 0.99, reason: "Common apostrophe correction" }],
  ["cant", { replacement: "can’t", confidence: 0.99, reason: "Common apostrophe correction" }],
  ["wont", { replacement: "won’t", confidence: 0.99, reason: "Common apostrophe correction" }],
  ["teh", { replacement: "the", confidence: 0.98, reason: "Common typing error" }],
  ["adn", { replacement: "and", confidence: 0.98, reason: "Common typing error" }],
  ["thier", { replacement: "their", confidence: 0.98, reason: "Common typing error" }],
  ["recieve", { replacement: "receive", confidence: 0.98, reason: "Common spelling" }],
  ["becuase", { replacement: "because", confidence: 0.98, reason: "Common typing error" }],
  ["seperate", { replacement: "separate", confidence: 0.98, reason: "Common spelling" }]
]);

function preserveCase(source, replacement) {
  if (source === source.toUpperCase()) return replacement.toUpperCase();
  if (source.length && source[0] === source[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

function confidenceFor(word, prefix) {
  const base = Math.min(0.97, 0.64 + Math.max(0, prefix.length - 1) * 0.08);
  const frequency = WORDS.get(word) ?? 0;
  return Math.min(0.96, base + Math.min(frequency / 10000, 0.12));
}

export function suggest({ text = "", cursor = text.length, settings = {}, userWords = [] } = {}) {
  if (!settings.enabled || !text || cursor < 0 || cursor > text.length) return { type: "idle" };

  const before = text.slice(0, cursor);
  const match = before.match(/[A-Za-z’']+$/u);
  if (!match) return { type: "idle" };
  const token = match[0];
  const start = cursor - token.length;
  const after = text.slice(cursor);
  const tokenAtEnd = after.length === 0;
  const mode = settings.suggestionMode ?? "balanced";
  const threshold = ({ fewer: 0.84, balanced: 0.72, more: 0.62 })[mode] ?? 0.72;

  if (settings.correctionEnabled && tokenAtEnd) {
    const correction = CORRECTIONS.get(token.toLowerCase());
    if (correction && !userWords.some(word => word.toLowerCase() === token.toLowerCase())) {
      return {
        type: "correction",
        token,
        replacement: preserveCase(token, correction.replacement),
        start,
        end: cursor,
        confidence: correction.confidence,
        reason: correction.reason
      };
    }
  }

  if (!settings.completionEnabled || token.length < (settings.minimumPrefixLength ?? 2)) {
    return { type: "idle" };
  }

  const lower = token.toLowerCase();
  const choices = new Map(WORDS);
  for (const word of userWords) choices.set(word, Math.max(choices.get(word) ?? 0, 1100));
  if (userWords.some(word => word.toLowerCase() === lower)) return { type: "idle" };

  const best = [...choices.entries()]
    .filter(([word]) => word.toLowerCase().startsWith(lower) && word.length > token.length)
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))[0];
  if (!best) return { type: "idle" };

  const confidence = confidenceFor(best[0], token);
  if (confidence < threshold) return { type: "idle" };
  const completed = token[0] === token[0].toUpperCase()
    ? best[0][0].toUpperCase() + best[0].slice(1)
    : best[0];
  return {
    type: "completion",
    token,
    word: completed,
    suffix: completed.slice(token.length),
    start,
    end: cursor,
    confidence,
    reason: "Local word-frequency match"
  };
}

export const builtInWords = [...WORDS.keys()].sort((a, b) => a.localeCompare(b));
