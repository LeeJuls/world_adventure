// Region gate — "직선 항로" (linear voyage route). REGION_ROUTE[i] becomes enterable once
// REGION_ROUTE[i-1] is FULLY discovered (all its ports found). east_asia (index 0) is the
// start and is always enterable. Pure data — no scene imports. All gate UI strings live here
// (no hardcoded UI strings in scenes), mirroring the ports.ts / quests.ts data pattern.

export const REGION_ROUTE: string[] = [
  'east_asia', 'southeast_asia', 'south_asia', 'middle_east',
  'southern_europe', 'western_europe', 'northern_europe', 'eastern_europe',
  'north_africa', 'east_africa', 'west_africa', 'southern_africa',
  'eastern_south_america', 'western_south_america', 'central_america', 'north_america',
  'oceania',
];

// Gate UI text (data-ized; {cur}/{n}/{N}/{next} placeholders filled by the scene).
export const GATE_MSG = {
  blocked: '{cur}의 모든 도시({n}/{N})를 발견해야 {next}로 갈 수 있어요!',
  hudPrefix: '🧭 다음 항로',
  allClear: '🎉 모든 대륙을 발견했어요!',
};

// Boot guard: REGION_ROUTE must be a 1:1 cover of the real continent ids (no unknown / no
// duplicate / nothing missing) and must start at east_asia. Returns warning strings (empty = ok).
// Mirrors validateQuests() — surfaces a typo'd/forgotten continent before it can silently break gating.
export function validateRoute(validContinentIds: Set<string>): string[] {
  const warnings: string[] = [];
  const seen = new Set<string>();
  for (const id of REGION_ROUTE) {
    if (!validContinentIds.has(id)) warnings.push(`route references unknown continent "${id}"`);
    if (seen.has(id)) warnings.push(`route has duplicate "${id}"`);
    seen.add(id);
  }
  for (const id of validContinentIds) {
    if (!seen.has(id)) warnings.push(`route is missing continent "${id}"`);
  }
  if (REGION_ROUTE[0] !== 'east_asia') {
    warnings.push(`route must start at east_asia (got "${REGION_ROUTE[0]}")`);
  }
  return warnings;
}
