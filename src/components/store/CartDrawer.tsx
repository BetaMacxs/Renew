"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { setCartDrawer, useCartDrawer, useCartLines } from "@/lib/cart/store";
import { useCartQuote } from "@/lib/cart/useCartQuote";
import { buttonClass } from "@/components/ui/button";
import { Drawer } from "@/components/ui/Drawer";
import { CartLines, FreeShippingMeter } from "./CartLines";
import { CheckoutLink } from "./CheckoutLink";
import { useStore } from "./StoreProvider";
import styles from "./store.module.css";

export function CartDrawer() {
  const open = useCartDrawer();
  const { lines, hydrated } = useCartLines();
  // Only quote while the drawer is open; the bag page quotes for itself.
  const { quote, loading, failed } = useCartQuote(open ? lines : [], hydrated && open);
  const { t, money } = useStore();
  const close = () => setCartDrawer(false);

  const footer =
    lines.length > 0 && quote ? (
      <div className={styles.cartDrawerFooter}>
        <div className={styles.cartSubtotalRow}>
          <span className={styles.cartSubtotalLabel}>{t.cart.subtotal}</span>
          <span className={`price ${styles.cartSubtotalValue}`}>{money(quote.subtotal, "full")}</span>
        </div>
        <p className={styles.cartShippingNote}>
          {t.cart.shipping}: {t.cart.shippingAtCheckout}
        </p>
        <div className={styles.cartActionsGrid}>
          <Link href="/cart" onClick={close} className={buttonClass({ variant: "outline", full: true })}>
            {t.cart.viewCart}
          </Link>
          <CheckoutLink
            onClick={close}
            aria-disabled={!quote.orderable}
            className={buttonClass({
              variant: "primary",
              full: true,
              className: !quote.orderable ? styles.cartDisabledLink : "",
            })}
          >
            {t.cart.checkout}
          </CheckoutLink>
        </div>
      </div>
    ) : null;

  return (
    <Drawer
      open={open}
      onClose={close}
      title={
        <span className={styles.cartDrawerTitle}>
          {t.cart.title}
          {quote && quote.itemCount > 0 && <span className={styles.cartDrawerCount}>({quote.itemCount})</span>}
        </span>
      }
      closeLabel={t.common.close}
      footer={footer}
    >
      <div className={styles.cartDrawerBody}>
        {!hydrated || (lines.length > 0 && !quote && !failed) ? (
          <p className={styles.cartStatusMsg} role="status">
            {t.common.loading}
          </p>
        ) : lines.length === 0 ? (
          <div className={styles.cartEmptyWrap}>
            <span className={styles.cartEmptyIcon}>
              <ShoppingBag size={22} />
            </span>
            <div>
              <p className={styles.cartEmptyTitle}>{t.cart.empty}</p>
              <p className={styles.cartEmptyText}>{t.cart.emptyText}</p>
            </div>
            <Link href="/shop" onClick={close} className={buttonClass({ variant: "dark" })}>
              {t.common.continueShopping}
            </Link>
          </div>
        ) : failed && !quote ? (
          <p className={styles.cartErrorMsg}>{t.cart.quoteFailed}</p>
        ) : quote ? (
          <div className={`${styles.cartContent} ${loading ? styles.cartContentLoading : ""}`.trim()}>
            <FreeShippingMeter quote={quote} />
            <CartLines quote={quote} compact />
          </div>
        ) : null}
      </div>
    </Drawer>
  );
}
