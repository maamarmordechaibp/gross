import { describe, it, expect } from 'vitest';
import { calculatePrice } from '@/lib/pricing/calculate';
import { autoPrice } from '@/lib/pricing/auto-price';

describe('calculatePrice', () => {
  it('computes base subtotal and revenue', () => {
    const r = calculatePrice({
      quantity: 100, unitPrice: 1,
      paperCostPerSheet: 0.05, paperQty: 50,
      finishings: [],
      isRush: false, taxRate: 0.0875,
    });
    expect(r.paperCost).toBe(2.5);
    expect(r.revenue).toBe(100);
    expect(r.tax).toBeCloseTo(8.75, 2);
  });

  it('applies rush surcharge to subtotal cost', () => {
    const r = calculatePrice({
      quantity: 1, unitPrice: 100,
      paperCostPerSheet: 0, paperQty: 0,
      finishings: [{ cost_per_unit: 10, qty: 2 }],
      isRush: true, rushMultiplier: 0.25, taxRate: 0,
    });
    expect(r.finishingCost).toBe(20);
    expect(r.rushSurcharge).toBe(5);
    expect(r.totalCost).toBe(25);
  });

  it('reports profit and margin', () => {
    const r = calculatePrice({
      quantity: 10, unitPrice: 10,
      paperCostPerSheet: 1, paperQty: 10,
      finishings: [],
      isRush: false, taxRate: 0,
    });
    expect(r.revenue).toBe(100);
    expect(r.totalCost).toBe(10);
    expect(r.profit).toBe(90);
    expect(r.marginPct).toBe(90);
  });
});

describe('autoPrice tiered margins', () => {
  const baseInput = {
    quantity: 0,
    paperCostPerSheet: 1,
    piecesPerSheet: 1,
    color: 'color' as const,
    sides: 1 as const,
    inkBw1Side: 0, inkBw2Side: 0, inkColor1Side: 0, inkColor2Side: 0,
    finishingsTotalCost: 0,
  };

  it('applies the tier whose min_qty bracket contains the quantity', () => {
    const tiers = [
      { min_qty: 0, margin_pct: 1.0 },     // 100% on first 99
      { min_qty: 100, margin_pct: 0.5 },   // 50% on 100-499
      { min_qty: 500, margin_pct: 0.25 },  // 25% on 500+
    ];
    // qty 50 sits entirely in tier 0 → unit = cost * 2 = $2 → revenue = $100
    const a = autoPrice({ ...baseInput, quantity: 50, marginTiers: tiers });
    expect(a.tierLines.length).toBe(1);
    expect(a.tierLines[0].unitPrice).toBe(2);
    expect(a.revenueTotal).toBe(100);
  });

  it('blends across multiple tiers', () => {
    const tiers = [
      { min_qty: 0, margin_pct: 1.0 },
      { min_qty: 100, margin_pct: 0.5 },
    ];
    // qty 200: units 1-100 @ $2 = $200, units 101-200 (100 units) @ $1.50 = $150, total $350
    const a = autoPrice({ ...baseInput, quantity: 200, marginTiers: tiers });
    expect(a.tierLines.length).toBe(2);
    expect(a.tierLines[0].toQty).toBe(100);
    expect(a.tierLines[1].fromQty).toBe(101);
    expect(a.revenueTotal).toBeCloseTo(350, 2);
  });

  it('inserts a 0-margin tier when tiers do not start at 0', () => {
    const tiers = [{ min_qty: 100, margin_pct: 0.5 }];
    // qty 50 falls below the lowest tier → forced 0% margin tier → unit = cost = $1
    const a = autoPrice({ ...baseInput, quantity: 50, marginTiers: tiers });
    expect(a.tierLines[0].marginPct).toBe(0);
    expect(a.tierLines[0].unitPrice).toBe(1);
  });
});

