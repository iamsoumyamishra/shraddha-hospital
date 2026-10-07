export const RATING_MIN = 1;
export const RATING_MAX = 5;

export type Rating = 1 | 2 | 3 | 4 | 5;

export function isRating(value: unknown): value is Rating {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= RATING_MIN &&
    value <= RATING_MAX
  );
}

export class ScoringError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScoringError";
  }
}

export function assertRating(value: unknown): asserts value is Rating {
  if (!isRating(value)) {
    throw new ScoringError(`Rating must be an integer between ${RATING_MIN} and ${RATING_MAX}, received ${String(value)}`);
  }
}