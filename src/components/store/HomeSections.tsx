import { ArrowRight, Banknote, Landmark, Store, Truck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { WhatsAppIcon } from "@/components/icons/brands";
import { buttonClass } from "@/components/ui/button";
import { formatMoney, type MoneyFormat } from "@/lib/domain/money";
import { enabledCheckoutMethods, type HomepageSection, type StoreSettings } from "@/lib/domain/settings";
import type { Collection, Product } from "@/lib/domain/types";
import type { Dictionary } from "@/lib/i18n";
import { ProductCard } from "./ProductCard";
import styles from "./store.module.css";

/* -------------------------------------------------------------- frames */

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`dc-container ${className}`.trim()}>{children}</div>;
}

export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className={styles.sectionHeader}>
      <h2 className={`display ${styles.sectionHeaderTitle}`}>{title}</h2>
      {action && (
        <Link href={action.href} className={styles.sectionHeaderAction}>
          {action.label}
          <ArrowRight size={16} className={`flip-rtl ${styles.sectionHeaderArrow}`} />
        </Link>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- hero */

export function Hero({ settings }: { settings: StoreSettings }) {
  const hero = settings.homepage.hero;
  if (!hero.enabled) return null;
  const hasImage = Boolean(hero.imageUrl);
  return (
    <section className={styles.heroSection}>
      <Container>
        <div className={`${styles.heroGrid} ${hasImage ? styles.heroGridWithImage : ""}`.trim()}>
          <div className={`${styles.heroContent} ${hasImage ? styles.heroContentWithImage : styles.heroContentSolo}`}>
            {hero.eyebrow && <p className={`eyebrow ${styles.heroEyebrow}`}>{hero.eyebrow}</p>}
            <h1 className={`display ${styles.heroHeading}`}>{hero.heading}</h1>
            {hero.text && <p className={styles.heroText}>{hero.text}</p>}
            {(hero.primaryLabel || hero.secondaryLabel) && (
              <div className={styles.heroActions}>
                {hero.primaryLabel && hero.primaryHref && (
                  <Link href={hero.primaryHref} className={buttonClass({ size: "lg" })}>
                    {hero.primaryLabel}
                  </Link>
                )}
                {hero.secondaryLabel && hero.secondaryHref && (
                  <Link href={hero.secondaryHref} className={buttonClass({ size: "lg", variant: "outline" })}>
                    {hero.secondaryLabel}
                  </Link>
                )}
              </div>
            )}
          </div>
          {hasImage && (
            <div className={styles.heroMedia}>
              <Image
                src={hero.imageUrl}
                alt=""
                fill
                priority
                sizes="(min-width: 1024px) 58vw, 100vw"
                className={styles.imgCover}
              />
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}

/* --------------------------------------------------------- product rows */

export function ProductRow({
  title,
  products,
  money,
  t,
  action,
}: {
  title: string;
  products: Product[];
  money: MoneyFormat;
  t: Dictionary;
  action?: { href: string; label: string };
}) {
  if (products.length === 0) return null;
  return (
    <section className={styles.homeSection}>
      <Container>
        <SectionHeader title={title} action={action} />
      </Container>
      {/* A swipeable rail on phones, a grid from tablets up. */}
      <ul className={`scrollbar-none ${styles.productRail}`}>
        {products.map((product) => (
          <li key={product.id} className={styles.productRailItem}>
            <ProductCard product={product} money={money} t={t} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/* --------------------------------------------------------------- banner */

export function Banner({ section }: { section: Extract<HomepageSection, { type: "banner" }> }) {
  if (!section.heading && !section.imageUrl) return null;
  const end = section.align === "end";
  return (
    <section className={styles.homeSection}>
      <Container>
        <div className={styles.bannerBox}>
          {section.imageUrl && (
            <div className={styles.bannerMedia}>
              <Image src={section.imageUrl} alt="" fill sizes="(min-width: 1440px) 1376px, 100vw" className={styles.imgCover} />
            </div>
          )}
          <div
            className={`${styles.bannerCard} ${
              section.imageUrl
                ? `${styles.bannerCardWithImage} ${end ? styles.bannerCardEnd : styles.bannerCardStart}`
                : styles.bannerCardSolo
            }`}
          >
            {section.eyebrow && <p className="eyebrow">{section.eyebrow}</p>}
            {section.heading && <h2 className={`display ${styles.bannerHeading}`}>{section.heading}</h2>}
            {section.text && <p className={styles.bannerText}>{section.text}</p>}
            {section.linkLabel && section.linkHref && (
              <Link href={section.linkHref} className={buttonClass({ variant: "dark", className: styles.bannerCta })}>
                {section.linkLabel}
                <ArrowRight size={16} className="flip-rtl" />
              </Link>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ---------------------------------------------------------- collections */

export function CollectionCards({
  title,
  collections,
  counts,
  t,
}: {
  title: string;
  collections: Collection[];
  counts: Map<string, number>;
  t: Dictionary;
}) {
  if (collections.length === 0) return null;
  return (
    <section className={styles.homeSection}>
      <Container>
        <SectionHeader title={title || t.home.collectionsTitle} />
        <ul className={styles.collectionsGrid}>
          {collections.map((collection) => (
            <li key={collection.id}>
              <Link href={`/collections/${collection.slug}`} className={styles.collectionCardLink}>
                <div className={styles.collectionCardMedia}>
                  {collection.imageUrl && (
                    <Image
                      src={collection.imageUrl}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw"
                      className={styles.collectionCardImg}
                    />
                  )}
                </div>
                <div className={styles.collectionCardMeta}>
                  <h3 className={styles.collectionCardTitle}>{collection.name}</h3>
                  <span className={`price ${styles.collectionCardCount}`}>
                    {t.common.products(counts.get(collection.id) ?? 0)}
                  </span>
                </div>
                {collection.description && <p className={styles.collectionCardDesc}>{collection.description}</p>}
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

/* ----------------------------------------------------------- highlights */

/**
 * Promises the store actually keeps, derived from its settings — change the
 * delivery threshold or switch off cash on delivery and this follows.
 */
export function Highlights({ settings, t }: { settings: StoreSettings; t: Dictionary }) {
  const money: MoneyFormat = { currency: settings.store.currency, locale: settings.store.language === "ar" ? "ar-u-nu-latn" : settings.store.language };
  const items: { icon: ReactNode; title: string; text: string }[] = [];
  const { freeShippingThreshold, methods, areas } = settings.shipping;
  const paid = methods.filter((method) => method.price > 0);

  if (freeShippingThreshold) {
    items.push({
      icon: <Truck size={22} strokeWidth={1.6} />,
      title: t.highlights.freeShippingOver(formatMoney(freeShippingThreshold, money)),
      text: t.highlights.freeShippingOverText,
    });
  } else if (paid.length > 0) {
    items.push({
      icon: <Truck size={22} strokeWidth={1.6} />,
      title: t.highlights.deliveryFrom(formatMoney(Math.min(...paid.map((method) => method.price)), money)),
      text: t.highlights.deliveryText(areas),
    });
  }
  if (methods.some((method) => !method.requiresAddress && method.price === 0)) {
    items.push({ icon: <Store size={22} strokeWidth={1.6} />, title: t.highlights.pickup, text: t.highlights.pickupText });
  }
  for (const method of enabledCheckoutMethods(settings)) {
    if (method === "cod") items.push({ icon: <Banknote size={22} strokeWidth={1.6} />, title: t.highlights.cod, text: t.highlights.codText });
    if (method === "bank_transfer") items.push({ icon: <Landmark size={22} strokeWidth={1.6} />, title: t.highlights.bank, text: t.highlights.bankText });
    if (method === "whatsapp") items.push({ icon: <WhatsAppIcon size={21} />, title: t.highlights.whatsapp, text: t.highlights.whatsappText });
  }
  if (items.length === 0) return null;

  return (
    <section className={styles.homeSection}>
      <Container>
        <ul className={styles.highlightsGrid}>
          {items.slice(0, 4).map((item) => (
            <li key={item.title} className={styles.highlightsItem}>
              <span className={styles.highlightsIcon}>{item.icon}</span>
              <div>
                <p className={styles.highlightsTitle}>{item.title}</p>
                <p className={styles.highlightsText}>{item.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
