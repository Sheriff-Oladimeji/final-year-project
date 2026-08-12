// Deterministic, regex-based checks — no LLM judge needed for these, so they're
// free and exact. Complements the llm-rubric assertions in promptfooconfig.yaml,
// which grade the fuzzier "does this feel clear" quality.

function labelMatches(output, context) {
  const label = output.trim().toLowerCase().split(/\s/)[0] || "";
  const expected = String(context.vars.expected || "").toLowerCase();
  return {
    pass: label === expected,
    score: label === expected ? 1 : 0,
    reason: `got "${label}", expected "${expected}"`,
  };
}

// The exact failure this session's real-tester bug reports flagged: an analogy or
// concrete grounding example bolted on AFTER the structured breakdown, instead of
// coming right after the lead sentence to build intuition first.
function noBackload(output) {
  const analogyCue = /(think of|imagine|picture it|similar to|like a\b|like an\b|like water|like the)/i;
  const listMarker = /^(\s*[-*]\s|\s*\d+\.\s)/m;
  const analogyIdx = output.search(analogyCue);
  const listIdx = output.search(listMarker);

  if (analogyIdx === -1) {
    return { pass: false, score: 0.4, reason: "no analogy / concrete-grounding phrase detected anywhere" };
  }
  if (listIdx === -1) {
    return { pass: true, score: 1, reason: "no structured list in this answer — nothing to backload against" };
  }
  const pass = analogyIdx < listIdx;
  return {
    pass,
    score: pass ? 1 : 0,
    reason: pass
      ? "analogy/grounding appears before the structured breakdown"
      : "analogy appears AFTER the list — backloaded, textbook-paragraph-then-fix pattern",
  };
}

function noFiller(output) {
  const filler = /^\s*(great question|sure[,!]|certainly|of course|i'd be happy|as an ai)/i;
  const pass = !filler.test(output);
  return { pass, score: pass ? 1 : 0, reason: pass ? "no filler opener" : "starts with filler / throat-clearing" };
}

function hasBoldTerm(output) {
  const pass = /\*\*[^*]+\*\*/.test(output);
  return { pass, score: pass ? 1 : 0, reason: pass ? "has a bolded key term" : "no bolded term found" };
}

module.exports = { labelMatches, noBackload, noFiller, hasBoldTerm };
