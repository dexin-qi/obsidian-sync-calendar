/**
 * Compares two moments by date.
 * @param a - The first moment to compare.
 * @param b - The second moment to compare.
 * @returns -1 if a is before b, 0 if they are the same, and 1 if a is after b.
 */
export function compareByDate(a: moment.Moment | null, b: moment.Moment | null): -1 | 0 | 1 {
  if (a !== null && b === null) {
      return -1;
  } else if (a === null && b !== null) {
      return 1;
  } else if (a !== null && b !== null) {
      if (a.isValid() && !b.isValid()) {
          return -1;
      } else if (!a.isValid() && b.isValid()) {
          return 1;
      }

      if (a.isAfter(b)) {
          return 1;
      } else if (a.isBefore(b)) {
          return -1;
      } else {
          return 0;
      }
  } else {
      return 0;
  }
}
