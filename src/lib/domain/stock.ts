import type { OrderItem, Product } from "./types";

export class InsufficientStockError extends Error {
  constructor(productName: string, requested: number, available: number) {
    super(`Not enough stock for "${productName}": ${requested} requested, ${available} left.`);
    this.name = "InsufficientStockError";
  }
}

/**
 * Applies an order's items to a product's stock: `delta` +1 takes units out
 * (the order was confirmed), -1 puts them back (a confirmed order was
 * cancelled). Only tracked products move. When reserving (`delta === 1`),
 * tracked variants must still exist with enough stock or `InsufficientStockError`
 * is thrown so an order can never oversell.
 *
 * The Supabase backend does the same in SQL (`admin_transition_order`), inside
 * the transaction that locks the product rows and changes the order's status.
 */
export function applyStockDelta(
  product: Product,
  items: readonly OrderItem[],
  delta: -1 | 0 | 1,
): Product | null {
  if (delta === 0 || !product.trackInventory) return null;

  const requestedByVariant = new Map<string, number>();
  for (const item of items) {
    if (item.productId !== product.id || !item.variantId || item.quantity <= 0) continue;
    requestedByVariant.set(item.variantId, (requestedByVariant.get(item.variantId) ?? 0) + item.quantity);
  }
  if (requestedByVariant.size === 0) return null;

  if (delta === 1) {
    for (const [variantId, units] of requestedByVariant) {
      const variant = product.variants.find((candidate) => candidate.id === variantId);
      if (!variant) {
        throw new Error(`Cannot confirm order: a selected option for "${product.name}" no longer exists.`);
      }
      if (variant.stock < units) {
        throw new InsufficientStockError(product.name, units, Math.max(0, variant.stock));
      }
    }
  }

  let changed = false;
  const variants = product.variants.map((variant) => {
    const units = requestedByVariant.get(variant.id) ?? 0;
    if (units === 0) return variant;
    changed = true;
    return { ...variant, stock: Math.max(0, variant.stock - delta * units) };
  });
  return changed ? { ...product, variants } : null;
}
