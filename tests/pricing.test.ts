import { describe, it, expect } from 'vitest';
import { calculatePrice } from '@/lib/pricing/calculate';

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

