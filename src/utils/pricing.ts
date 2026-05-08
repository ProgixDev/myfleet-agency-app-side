import type { PricingConfig } from "@/types/billing";

// ── Default config ──────────────────────────────────────────────────────────

export const DEFAULT_PRICING: PricingConfig = {
  weekendSurcharge: 1.2,
  highSeasonMultiplier: 1.5,
  highSeasonMonths: [7, 8], // July, August
  longRentalDiscounts: [
    { minDays: 7, discount: 0.1 },
    { minDays: 14, discount: 0.15 },
    { minDays: 30, discount: 0.2 },
  ],
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

function isHighSeason(date: Date, months: number[]): boolean {
  return months.includes(date.getMonth() + 1); // getMonth() is 0-based
}

function getLongRentalDiscount(
  days: number,
  discounts: PricingConfig["longRentalDiscounts"],
): number {
  // Sort descending by minDays so we pick the best applicable discount first
  const sorted = [...discounts].sort((a, b) => b.minDays - a.minDays);
  const match = sorted.find((d) => days >= d.minDays);
  return match ? match.discount : 0;
}

// ── Main calculator ─────────────────────────────────────────────────────────

/**
 * Computes a rental total. Inputs and outputs are in **cents** (the canonical
 * monetary unit on the wire and in the DB). Pass integer cents in; you get
 * integer cents back.
 */
export function calculateRentalPrice(
  dailyRate: number,
  startDate: string,
  endDate: string,
  config?: PricingConfig,
): {
  days: number;
  baseTotal: number;
  adjustedTotal: number;
  discount: number;
} {
  const cfg = config ?? DEFAULT_PRICING;

  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.max(
    1,
    Math.ceil((end.getTime() - start.getTime()) / 86_400_000),
  );

  // ── Base total (flat daily rate x days) ─────────────────────────────────
  const baseTotal = dailyRate * days;

  // ── Per-day adjusted rate ───────────────────────────────────────────────
  let adjustedTotal = 0;

  for (let i = 0; i < days; i++) {
    const current = new Date(start);
    current.setDate(current.getDate() + i);

    let dayRate = dailyRate;

    // Weekend surcharge
    if (isWeekend(current)) {
      dayRate *= cfg.weekendSurcharge;
    }

    // High-season multiplier
    if (isHighSeason(current, cfg.highSeasonMonths)) {
      dayRate *= cfg.highSeasonMultiplier;
    }

    adjustedTotal += dayRate;
  }

  // ── Long-rental discount ────────────────────────────────────────────────
  const discount = getLongRentalDiscount(days, cfg.longRentalDiscounts);

  if (discount > 0) {
    adjustedTotal *= 1 - discount;
  }

  return {
    days,
    baseTotal: Math.round(baseTotal),
    adjustedTotal: Math.round(adjustedTotal),
    discount,
  };
}
