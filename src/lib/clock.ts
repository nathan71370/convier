import "server-only";

/**
 * The current instant, read once per request.
 *
 * Pages genuinely need the clock — a countdown and a passed-deadline check are
 * both "compared to now" — but reading it inline makes a component's output
 * depend on when it ran. Funnelling it through one named call keeps that
 * dependency visible, and gives every helper below a `now` argument they can
 * be tested against.
 */
export function requestTime(): number {
  return Date.now();
}
