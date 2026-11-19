"use client";

import { Menu, Search, ShoppingBag, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { setCartDrawer, useCartLines } from "@/lib/cart/store";
import { formatMoney } from "@/lib/domain/money";
import { searchAction, type SearchHit } from "@/server/actions/storefront";
import { Drawer } from "@/components/ui/Drawer";
import { useStore } from "./StoreProvider";
import styles from "./store.module.css";

/* ------------------------------------------------------------------- bag */

export function CartButton() {
  const { lines, hydrated } = useCartLines();
  const { t } = useStore();
  const count = hydrated ? lines.reduce((total, line) => total + line.quantity, 0) : 0;
  return (
    <button
      type="button"
      onClick={() => setCartDrawer(true)}
      className={styles.headerIconBtn}
      aria-label={t.nav.openCart(count)}
      data-testid="cart-button"
    >
      <ShoppingBag size={21} strokeWidth={1.8} />
      {count > 0 && (
        <span className={`price ${styles.cartBadge}`}>
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}

/* ---------------------------------------------------------------- search */

export function SearchButton() {
  const [open, setOpen] = useState(false);
  const { t } = useStore();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={styles.headerIconBtn}
        aria-label={t.nav.search}
      >
        <Search size={20} strokeWidth={1.8} />
      </button>
      {open && <SearchPanel onClose={() => setOpen(false)} />}
    </>
  );
}

function SearchPanel({ onClose }: { onClose: () => void }) {
  const { t, config } = useStore();
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;
    const timer = setTimeout(() => {
      startTransition(async () => setHits(await searchAction(term)));
    }, 160);
    return () => clearTimeout(timer);
  }, [query]);
  // Under two letters there is nothing to suggest.
  const shown = query.trim().length < 2 ? [] : hits;

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && dialog.current?.close()}
      className={styles.searchDialog}
    >
      <div className={styles.searchSheet}>
        <form
          role="search"
          className={styles.searchForm}
          onSubmit={(event) => {
            event.preventDefault();
            const term = query.trim();
            dialog.current?.close();
            router.push(term ? `/shop?q=${encodeURIComponent(term)}` : "/shop");
          }}
        >
          <Search size={20} className={styles.searchIcon} />
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.nav.searchPlaceholder}
            aria-label={t.nav.searchPlaceholder}
            className={styles.searchInput}
            enterKeyHint="search"
          />
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className={styles.searchCloseBtn}
            aria-label={t.common.close}
          >
            <X size={20} />
          </button>
        </form>
        {(shown.length > 0 || pending) && (
          <div className={styles.searchResultsWrap}>
            <ul className={styles.searchResultsList} aria-busy={pending}>
              {shown.map((hit) => (
                <li key={hit.slug}>
                  <Link
                    href={`/products/${hit.slug}`}
                    onClick={() => dialog.current?.close()}
                    className={styles.searchHitLink}
                  >
                    <span className={styles.searchHitThumb}>
                      {hit.imageUrl && <Image src={hit.imageUrl} alt="" fill sizes="56px" className={styles.searchHitImg} />}
                    </span>
                    <span className={styles.searchHitName}>{hit.name}</span>
                    <span className={`price ${styles.searchHitPrice}`}>
                      {hit.varies
                        ? t.product.from(formatMoney(hit.price, config.money))
                        : formatMoney(hit.price, config.money)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </dialog>
  );
}

/* ------------------------------------------------------------ mobile menu */

export type MenuLink = { href: string; label: string };

export function MobileMenu({
  storeName,
  primary,
  secondary,
}: {
  storeName: string;
  primary: MenuLink[];
  secondary: MenuLink[];
}) {
  const [open, setOpen] = useState(false);
  const { t } = useStore();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={styles.headerIconBtn}
        aria-label={t.common.menu}
      >
        <Menu size={21} strokeWidth={1.8} />
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} title={storeName} side="start" closeLabel={t.common.close}>
        <nav className={styles.mobileNav}>
          <ul className={styles.mobilePrimaryList}>
            {primary.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={`display ${styles.mobilePrimaryLink}`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <ul className={styles.mobileSecondaryList}>
            {secondary.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={styles.mobileSecondaryLink}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Drawer>
    </>
  );
}
