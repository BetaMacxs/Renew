"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useCartLines } from "@/lib/cart/store";
import { useCartQuote } from "@/lib/cart/useCartQuote";
import { buttonClass } from "@/components/ui/button";
import { CartLines, FreeShippingMeter } from "./CartLines";
import { CheckoutLink } from "./CheckoutLink";
import { Receipt, ReceiptLine, ReceiptRule } from "./Receipt";
import { useStore } from "./StoreProvider";
import styles from "./store.module.css";

export function CartPage() {
  const { t, money } = useStore();
  const { lines, hydrated } = useCartLines();
  const { quote, loading, failed } = useCartQuote(lines, hydrated);

  if (!hydrated || (lines.length > 0 && !quote && !failed)) {
    return <p className={styles.cartPageStatus}>{t.common.loading}</p>;
  }

  if (lines.length === 0) {
    return (
      <div className={styles.cartPageEmpty}>
        <span className={styles.cartPageEmptyIcon}>
          <ShoppingBag size={24} />
        </span>
        <h2 className={styles.cartPageEmptyTitle}>{t.cart.empty}</h2>
        <p className={styles.cartPageEmptyText}>{t.cart.emptyText}</p>
        <Link href="/shop" className={buttonClass({ variant: "dark", className: styles.cartPageEmptyBtn })}>
          {t.common.continueShopping}
        </Link>
      </div>
    );
  }

  if (!quote) return <p className={styles.cartPageError}>{t.cart.quoteFailed}</p>;

  return (
    <div className={styles.cartPageGrid}>
      <div className={`${styles.cartContent} ${loading ? styles.cartContentLoading : ""}`.trim()}>
        <FreeShippingMeter quote={quote} />
        <CartLines quote={quote} />
      </div>
      <div className={styles.cartPageSummary}>
        <Receipt title={t.checkout.summary}>
          <ReceiptLine label={t.cart.subtotal} amount={money(quote.subtotal, "full")} strong />
          <ReceiptRule />
          <ReceiptLine label={t.cart.shipping} amount={t.cart.shippingAtCheckout} muted />
        </Receipt>
        <CheckoutLink
          aria-disabled={!quote.orderable}
          className={buttonClass({
            size: "lg",
            full: true,
            className: `${styles.cartPageCheckoutBtn} ${quote.orderable ? "" : styles.cartDisabledLink}`.trim(),
          })}
        >
          {t.cart.checkout}
        </CheckoutLink>
        <Link href="/shop" className={styles.cartPageContinue}>
          {t.common.continueShopping}
        </Link>
      </div>
    </div>
  );
}
