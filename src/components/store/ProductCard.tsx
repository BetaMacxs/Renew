import Image from "next/image";
import Link from "next/link";
import type { MoneyFormat } from "@/lib/domain/money";
import { imageAlt, isNewArrival, isSoldOut, primaryImage, priceSummary, secondaryImage } from "@/lib/domain/product";
import type { Product } from "@/lib/domain/types";
import type { Dictionary } from "@/lib/i18n";
import { Price } from "./Price";
import styles from "./store.module.css";

/**
 * A product in a grid. Rendered on the server: the whole card is one link,
 * the second photo fades in on hover, and badges state only facts (a real
 * discount, sold out, recently added).
 */

export function ProductCard({
  product,
  money,
  t,
  priority = false,
}: {
  product: Product;
  money: MoneyFormat;
  t: Dictionary;
  priority?: boolean;
}) {
  const image = primaryImage(product);
  const hover = secondaryImage(product);
  const price = priceSummary(product);
  const soldOut = isSoldOut(product);
  const isNew = isNewArrival(product);
  const swatches = product.options
    .find((option) => option.values.some((value) => value.swatch))
    ?.values.filter((value) => value.swatch);

  return (
    <Link href={`/products/${product.slug}`} className={styles.productCard}>
      <div className={styles.productCardMedia}>
        {image ? (
          <>
            <Image
              src={image.url}
              alt={imageAlt(product, image)}
              fill
              priority={priority}
              sizes="(min-width: 1280px) 300px, (min-width: 768px) 30vw, 48vw"
              className={`${styles.productCardImg} ${hover ? styles.productCardImgSwap : styles.productCardImgZoom} ${
                soldOut ? styles.productCardImgSoldOut : ""
              }`.trim()}
            />
            {hover && (
              <Image
                src={hover.url}
                alt=""
                fill
                sizes="(min-width: 1280px) 300px, (min-width: 768px) 30vw, 48vw"
                className={styles.productCardImgHover}
              />
            )}
          </>
        ) : (
          <div className={styles.productCardPlaceholder}>{product.name}</div>
        )}
        <div className={styles.productCardBadges}>
          {soldOut ? (
            <span className={styles.badgePill}>{t.product.soldOut}</span>
          ) : price.discount !== null ? (
            <span className={`price ${styles.badgePillSale}`}>{t.product.save(price.discount)}</span>
          ) : isNew ? (
            <span className={styles.badgePill}>{t.product.newBadge}</span>
          ) : null}
        </div>
      </div>
      <div className={styles.productCardMeta}>
        <h3 className={styles.productCardTitle}>{product.name}</h3>
        <div className={styles.productCardPriceRow}>
          <Price
            amount={price.min}
            compareAt={price.compareAt}
            money={money}
            from={price.varies ? t.product.from : undefined}
            wasLabel={t.product.wasPrice}
            size="sm"
          />
          {swatches && swatches.length > 1 && (
            <span className={styles.swatchStack} aria-hidden="true">
              {swatches.slice(0, 4).map((value) => (
                <span
                  key={value.label}
                  className={styles.swatchDot}
                  style={{ background: value.swatch ?? undefined }}
                />
              ))}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function ProductGrid({
  products,
  money,
  t,
  priorityCount = 0,
  columns = "default",
}: {
  products: Product[];
  money: MoneyFormat;
  t: Dictionary;
  priorityCount?: number;
  columns?: "default" | "wide";
}) {
  return (
    <ul className={`${styles.productGrid} ${columns === "wide" ? styles.productGridWide : styles.productGridDefault}`}>
      {products.map((product, index) => (
        <li key={product.id}>
          <ProductCard product={product} money={money} t={t} priority={index < priorityCount} />
        </li>
      ))}
    </ul>
  );
}
