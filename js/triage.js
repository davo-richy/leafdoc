// Turns a diagnosis into one of three time-based actions plus the food-safety line.
// Pure and dependency-free so it can be tested in Node and reused by the share card.

const SEVERITY = { low: 1, moderate: 2, high: 3 };

function severityOf(problem) {
  return SEVERITY[String(problem?.severity || "").toLowerCase()] || 0;
}

export function triageFor(result) {
  const r = result || {};
  const problems = Array.isArray(r.problems) ? r.problems.filter((p) => p && p.name) : [];
  const top = problems[0] || null;
  const worst = problems.reduce((worst, p) => Math.max(worst, severityOf(p)), 0);
  const treatment = r.treatment || {};
  const organic = Array.isArray(treatment.organic) ? treatment.organic.filter(Boolean) : [];
  const chemical = Array.isArray(treatment.chemical) ? treatment.chemical.filter(Boolean) : [];
  const prevention = Array.isArray(treatment.prevention) ? treatment.prevention.filter(Boolean) : [];
  const confidence = Math.max(0, Math.min(100, Number(r.overall_confidence) || 0));

  let level, title, line;
  if (r.healthy) {
    level = "monitor";
    title = "Monitor";
    line = "No clear problem in these photos. Check the plant again in a week.";
  } else if (worst >= 3 || r.urgent_note) {
    level = "today";
    title = "Act today";
    line = "This can spread or damage the plant quickly. Start today and look again tomorrow.";
  } else if (worst >= 1) {
    level = "week";
    title = "This week";
    line = "Not an emergency, but treat it within a few days before it spreads.";
  } else if (confidence >= 60) {
    level = "week";
    title = "This week";
    line = "The photos show a problem but its cause is not clear. Try the first step below and watch for changes.";
  } else {
    level = "monitor";
    title = "Monitor";
    line = "We are not sure yet. Take one more clear photo in daylight before spraying anything.";
  }

  const steps = [...organic.slice(0, 2), ...prevention.slice(0, 1)];
  if (!steps.length) steps.push("Take another photo in daylight so the next check is more reliable.");

  const urgentMentionsEating = /eat|edibl|consume|harvest/i.test(String(r.urgent_note || ""));
  const eat = chemical.length || urgentMentionsEating
    ? "Do not eat leaves or fruit from this plant until the waiting period on the product label has passed."
    : "";

  return { level, title, line, steps, eat, confidence, top: top ? top.name : "" };
}
