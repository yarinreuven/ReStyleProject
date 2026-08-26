const DAY_IN_MS = 24 * 60 * 60 * 1000;
export const LESS_WORN_DAYS = 60;
export const RECENT_DAYS = 7;

const automaticRestyleCategories = new Set([
  "Tops",
  "Bottoms",
  "Dresses",
  "Jackets"
]);

export function daysSince(date) {
  if (!date) return Infinity;
  return Math.floor((Date.now() - new Date(date).getTime()) / DAY_IN_MS);
}

export function isLessWorn(item) {
  const referenceDate = item.lastWornAt || item.createdAt;
  return daysSince(referenceDate) >= LESS_WORN_DAYS;
}

export function isRecentlyAdded(item) {
  if (!item.createdAt) return false;
  const age = Date.now() - new Date(item.createdAt).getTime();
  return age >= 0 && age <= RECENT_DAYS * DAY_IN_MS;
}

export function isAutomaticallyEligibleForRestyle(item) {
  return Boolean(
    item?.image &&
    isLessWorn(item) &&
    automaticRestyleCategories.has(item.category)
  );
}
