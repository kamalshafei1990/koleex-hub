/* KDS-1 §1 — the ONLY brand color constants allowed in app code. */
export const HUB = {
  deep: "#3E6796",
  steel: "#567FB2",
  sky: "#7FA9D6",
  ice: "#BCD8F0",
} as const;
export const HUB_GRADIENT = `linear-gradient(135deg, ${HUB.steel}, ${HUB.sky}, ${HUB.ice})`;
export const STATUS = { success: "#10B981", warning: "#F59E0B", error: "#FF3333" } as const;
