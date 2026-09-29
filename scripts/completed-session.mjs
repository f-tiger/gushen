// US-listed daily bars may contain a live, unfinished "adjclose" observation.
// Wait until 17:00 New York time (regular close + one hour); on early-close
// days this is deliberately conservative. The source provides actual dates,
// so this cutoff does not manufacture weekend or holiday sessions.
export function completedDateCutoff(now = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((x) => [x.type, x.value]),
  );
  const day = `${p.year}-${p.month}-${p.day}`;
  if (Number(p.hour) >= 17) return day;
  return new Date(Date.parse(`${day}T00:00:00Z`) - 86400000)
    .toISOString()
    .slice(0, 10);
}
export function completedRows(rows, cutoff) {
  return rows.filter(
    ([d, v]) =>
      /^\d{4}-\d{2}-\d{2}$/.test(d) &&
      d <= cutoff &&
      typeof v === "number" &&
      Number.isFinite(v) &&
      v > 0,
  );
}
