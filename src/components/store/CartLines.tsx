"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { CartQuote, QuoteLine } from "@/lib/domain/cart";
import { removeLine, setCartDrawer, setLineQuantity } from "@/lib/cart/store";
import { useStore } from "./StoreProvider";
import styles from "./store.module.css";

/** The lines of a quoted bag, with quantity controls and honest notices. */
export function CartLines({ quote, compact = false }: { quote: CartQuote; compact?: boolean }) {
  return (
    <ul className={styles.cartLinesList}>
      {quote.lines.map((line) => (
        <CartLineRow key={line.key} line={line} compact={compact} />
      ))}
    </ul>
  );
}

function CartLineRow({ line, compact }: { line: QuoteLine; compact: boolean }) {
  const { t, money } = useStore();
  const unavailable = line.status === "unavailable";
  const notice =
    line.reason === "gone"
      ? t.cart.lineGone
      : line.reason === "variant-gone"
        ? t.cart.lineVariantGone
        : line.reason === "sold-out"
          ? t.cart.lineSoldOut
          : line.reason === "limited"
            ? t.cart.lineLimited(line.quantity)
            : null;
  const max = line.maxQuantity ?? 99;

  return (
    <li className={`${styles.cartLineItem} ${compact ? styles.cartLineItemCompact : ""}`.trim()}>
      <Link
        href={line.slug ? `/products/${line.slug}` : "#"}
        onClick={() => setCartDrawer(false)}
        className={`${styles.cartLineThumb} ${compact ? styles.cartLineThumbCompact : styles.cartLineThumbFull} ${
          unavailable ? styles.cartLineThumbUnavailable : ""
        }`.trim()}
      >
        {line.imageUrl && <Image src={line.imageUrl} alt="" fill sizes="104px" className={styles.imgCover} />}
      </Link>
      <div className={styles.cartLineBody}>
        <div className={styles.cartLineHeader}>
          <div className={styles.cartLineTitleWrap}>
            <Link
              href={line.slug ? `/products/${line.slug}` : "#"}
              onClick={() => setCartDrawer(false)}
              className={styles.cartLineTitle}
            >
              {line.name || "—"}
            </Link>
            {line.variantLabel && <p className={styles.cartLineVariant}>{line.variantLabel}</p>}
          </div>
          <p className={`price ${styles.cartLineTotal}`}>
            {unavailable ? "—" : money(line.lineTotal, "full")}
          </p>
        </div>
        {notice && (
          <p className={`${styles.cartLineNotice} ${unavailable ? styles.cartLineNoticeErr : styles.cartLineNoticeWarn}`}>
            {notice}
          </p>
        )}
        <div className={styles.cartLineActions}>
          {unavailable ? (
            <span />
          ) : (
            <div className={styles.cartQtyBox}>
              <button
                type="button"
                className={styles.cartQtyBtn}
                onClick={() => setLineQuantity(line.key, line.quantity - 1)}
                disabled={line.quantity <= 1}
                aria-label={t.product.decrease}
              >
                <Minus size={15} />
              </button>
              <span className={`price ${styles.cartQtyVal}`} aria-live="polite">
                {line.quantity}
              </span>
              <button
                type="button"
                className={styles.cartQtyBtn}
                onClick={() => setLineQuantity(line.key, line.quantity + 1)}
                disabled={line.quantity >= max}
                aria-label={t.product.increase}
              >
                <Plus size={15} />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => removeLine(line.key)}
            className={styles.cartRemoveBtn}
            aria-label={t.cart.removeItem(line.name)}
          >
            <Trash2 size={14} />
            {t.common.remove}
          </button>
        </div>
      </div>
    </li>
  );
}

/** "You're $12 away from free delivery", with a progress bar. */
export function FreeShippingMeter({ quote }: { quote: CartQuote }) {
  const { t, money, config } = useStore();
  const threshold = config.freeShippingThreshold;
  if (!threshold || quote.subtotal <= 0) return null;
  const remaining = quote.freeShippingRemaining;
  const progress = Math.min(100, (quote.subtotal / threshold) * 100);
  return (
    <div className={styles.freeShipBox}>
      <p className={styles.freeShipText}>
        {remaining ? t.cart.freeShippingRemaining(money(remaining, "full")) : t.cart.freeShippingUnlocked}
      </p>
      <div className={styles.freeShipTrack} aria-hidden="true">
        <div className={styles.freeShipFill} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
