import Image from "next/image";
import Link from "next/link";
import type { StoreSettings } from "@/lib/domain/settings";
import type { Category, Collection } from "@/lib/domain/types";
import type { Dictionary } from "@/lib/i18n";
import { CartButton, MobileMenu, SearchButton } from "./HeaderControls";
import styles from "./store.module.css";

/**
 * Announcement band, then the header: menu (mobile), wordmark, the first few
 * categories as signage-style navigation, search and the bag.
 */

export function Wordmark({ settings, className = "" }: { settings: StoreSettings; className?: string }) {
  if (settings.store.logoUrl) {
    return (
      <Image
        src={settings.store.logoUrl}
        alt={settings.store.name}
        width={160}
        height={48}
        className={`${styles.wordmarkImg} ${className}`.trim()}
        priority
      />
    );
  }
  return <span className={`display ${styles.wordmarkText} ${className}`.trim()}>{settings.store.name}</span>;
}

export function AnnouncementBar({ settings }: { settings: StoreSettings }) {
  const { announcement } = settings.homepage;
  if (!announcement.enabled || !announcement.text) return null;
  const content = <span className={styles.announcementText}>{announcement.text}</span>;
  return (
    <div className={styles.announcement}>
      <div className={styles.announcementInner}>
        {announcement.href ? (
          <Link href={announcement.href} className={styles.announcementLink}>
            {content}
            <span aria-hidden="true" className="flip-rtl">→</span>
          </Link>
        ) : (
          content
        )}
      </div>
    </div>
  );
}

export function Header({
  settings,
  categories,
  collections,
  t,
}: {
  settings: StoreSettings;
  categories: Category[];
  collections: Collection[];
  t: Dictionary;
}) {
  const navCategories = categories.slice(0, 5);
  const primary = [
    { href: "/shop", label: t.nav.allProducts },
    ...categories.map((category) => ({ href: `/categories/${category.slug}`, label: category.name })),
  ];
  const secondary = [
    ...collections.map((collection) => ({ href: `/collections/${collection.slug}`, label: collection.name })),
    { href: "/pages/shipping", label: t.footer.shipping },
    { href: "/pages/returns", label: t.footer.returns },
    { href: "/pages/contact", label: t.footer.contact },
  ];

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <div className={styles.mobileMenuWrap}>
          <MobileMenu storeName={settings.store.name} primary={primary} secondary={secondary} />
        </div>
        <Link href="/" className={styles.wordmarkLink} aria-label={settings.store.name}>
          <Wordmark settings={settings} />
        </Link>
        <nav className={styles.desktopNav} aria-label={t.nav.categories}>
          <ul className={styles.desktopNavList}>
            <li>
              <Link href="/shop" className={styles.navPillLink}>
                {t.nav.shop}
              </Link>
            </li>
            {navCategories.map((category) => (
              <li key={category.id}>
                <Link href={`/categories/${category.slug}`} className={styles.navPillLink}>
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.headerActions}>
          <SearchButton />
          <CartButton />
        </div>
      </div>
    </header>
  );
}
