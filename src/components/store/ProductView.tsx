"use client";

import { Check, ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { WhatsAppIcon } from "@/components/icons/brands";
import { buttonClass } from "@/components/ui/button";
import { addToCart, setCartDrawer } from "@/lib/cart/store";
import { MAX_LINE_QUANTITY } from "@/lib/domain/cart";
import { discountPercent } from "@/lib/domain/money";
import {
  defaultVariant,
  findVariant,
  imageAlt,
  isVariantInStock,
  lowStockCount,
  optionValueState,
  priceSummary,
  stockLimit,
  variantLabel,
} from "@/lib/domain/product";
import type { Product, ProductImage } from "@/lib/domain/types";
import { buildInquiryMessage, whatsappUrl } from "@/lib/domain/whatsapp";
import { useStore } from "./StoreProvider";
import styles from "./store.module.css";

type Props = {
  product: Product;
  productUrl: string;
  category: { name: string; slug: string } | null;
  /** From a link to one variant (`?variant=…`, from the bag or shared). */
  variantId?: string | null;
  /** Server-rendered extras (description, details, delivery) under the buy box. */
  children?: ReactNode;
};

export function ProductView({ product, productUrl, category, variantId = null, children }: Props) {
  const { t, money, config } = useStore();

  // Colours (and options with a single value) start on the first buyable
  // variant; sizes, capacities and the like are left for the shopper to
  // choose, so nobody orders an XS by accident.
  const initial = useMemo(() => {
    const linked = variantId ? product.variants.find((candidate) => candidate.id === variantId) : null;
    if (linked) return product.options.map((_, index) => linked.optionValues[index] ?? null);
    const variant = defaultVariant(product);
    return product.options.map((option, index) =>
      option.values.length === 1 || option.values.some((value) => value.swatch)
        ? (variant?.optionValues[index] ?? null)
        : null,
    );
  }, [product, variantId]);

  const [selection, setSelection] = useState<(string | null)[]>(initial);
  const [chosenQuantity, setQuantity] = useState(1);
  const [missing, setMissing] = useState<number | null>(null);
  const [added, setAdded] = useState(false);

  const complete = selection.every((value) => value !== null);
  const variant = complete ? findVariant(product, selection) : null;
  const limit = variant ? stockLimit(product, variant) : null;
  const inStock = variant ? isVariantInStock(product, variant) : true;
  const low = variant ? lowStockCount(product, variant) : null;
  const summary = priceSummary(product);
  const price = variant?.price ?? summary.min;
  const compareAt = variant ? variant.compareAtPrice : summary.compareAt;
  const discount = discountPercent(price, compareAt);
  const maxQuantity = Math.max(1, Math.min(MAX_LINE_QUANTITY, limit ?? MAX_LINE_QUANTITY));
  // Never more than the chosen variant has in stock.
  const quantity = Math.min(chosenQuantity, maxQuantity);

  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(false), 2400);
    return () => clearTimeout(timer);
  }, [added]);

  const choose = (index: number, value: string) => {
    setSelection((current) => current.map((entry, position) => (position === index ? value : entry)));
    setMissing(null);
  };

  const add = () => {
    const firstMissing = selection.findIndex((value) => value === null);
    if (firstMissing >= 0 || !variant) {
      setMissing(firstMissing >= 0 ? firstMissing : 0);
      return;
    }
    if (!inStock) return;
    addToCart({ productId: product.id, variantId: variant.id, quantity });
    setAdded(true);
    setCartDrawer(true);
  };

  const inquiry = config.whatsapp.configured
    ? whatsappUrl(
        config.whatsapp.number,
        buildInquiryMessage(
          { name: product.name, variantLabel: variant ? variantLabel(variant) : "", url: productUrl },
          { storeName: config.storeName, labels: t.whatsapp },
        ),
      )
    : null;

  const activeImageId = variant?.imageId ?? null;

  return (
    <div className={styles.productLayout}>
      <Gallery product={product} activeImageId={activeImageId} />

      <div className={styles.productBuyBox}>
        {category && (
          <Link href={`/categories/${category.slug}`} className="eyebrow">
            {category.name}
          </Link>
        )}
        <h1 className={`display ${styles.productTitle}`}>{product.name}</h1>
        {product.summary && <p className={styles.productSummary}>{product.summary}</p>}

        <div className={styles.productPriceRow}>
          <span className={`price ${styles.productPriceMain} ${discount ? styles.productPriceDiscount : ""}`.trim()}>
            {!variant && summary.varies ? t.product.from(money(price)) : money(price)}
          </span>
          {discount !== null && compareAt != null && (
            <>
              <s className={`price ${styles.productPriceCompare}`}>
                <span className="sr-only">{t.product.wasPrice(money(compareAt))}</span>
                <span aria-hidden="true">{money(compareAt)}</span>
              </s>
              <span className={`price ${styles.productSaveBadge}`}>
                {t.product.save(discount)}
              </span>
            </>
          )}
        </div>

        {product.options.length > 0 && (
          <div className={styles.optionsStack}>
            {product.options.map((option, index) => {
              const swatches = option.values.some((value) => value.swatch);
              const chosen = selection[index];
              return (
                <fieldset key={option.name}>
                  <legend className={styles.optionLegend}>
                    <span>
                      <span className={styles.optionLegendName}>{option.name}</span>
                      {chosen && <span className={styles.optionLegendChosen}>: {chosen}</span>}
                    </span>
                    {missing === index && (
                      <span className={styles.optionMissing} role="alert">
                        {t.product.choose(option.name)}
                      </span>
                    )}
                  </legend>
                  <div className={styles.optionValuesRow}>
                    {option.values.map((value) => {
                      const state = optionValueState(product, index, value.label, selection);
                      const selected = chosen === value.label;
                      const soldOut = state !== "available";
                      if (swatches && value.swatch) {
                        return (
                          <button
                            key={value.label}
                            type="button"
                            onClick={() => choose(index, value.label)}
                            aria-pressed={selected}
                            aria-label={`${value.label}${soldOut ? ` — ${t.product.soldOut}` : ""}`}
                            title={value.label}
                            className={`${styles.swatchBtn} ${selected ? styles.swatchBtnSelected : ""}`.trim()}
                          >
                            <span
                              className={styles.swatchCircle}
                              style={{ background: value.swatch }}
                            />
                            {soldOut && (
                              <span
                                className={styles.swatchStrike}
                                aria-hidden="true"
                              />
                            )}
                          </button>
                        );
                      }
                      return (
                        <button
                          key={value.label}
                          type="button"
                          onClick={() => choose(index, value.label)}
                          aria-pressed={selected}
                          aria-label={`${value.label}${soldOut ? ` — ${t.product.soldOut}` : ""}`}
                          className={`${styles.optionBtn} ${
                            selected ? styles.optionBtnSelected : soldOut ? styles.optionBtnSoldOut : ""
                          }`.trim()}
                        >
                          {value.label}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              );
            })}
          </div>
        )}

        <p className={styles.stockStatus} aria-live="polite">
          <span
            className={`${styles.stockDot} ${
              !inStock ? styles.stockDotOut : low ? styles.stockDotLow : styles.stockDotIn
            }`}
            aria-hidden="true"
          />
          {!complete
            ? t.product.inStock
            : !inStock
              ? t.product.soldOut
              : low
                ? t.product.onlyLeft(low)
                : t.product.inStock}
        </p>

        <div className={styles.addToBagRow}>
          <div className={styles.qtyBox}>
            <button
              type="button"
              className={styles.qtyBtn}
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
              aria-label={t.product.decrease}
            >
              <Minus size={16} />
            </button>
            <span className={`price ${styles.qtyValue}`} aria-label={t.product.quantity}>
              {quantity}
            </span>
            <button
              type="button"
              className={styles.qtyBtn}
              onClick={() => setQuantity(Math.min(maxQuantity, quantity + 1))}
              disabled={quantity >= maxQuantity}
              aria-label={t.product.increase}
            >
              <Plus size={16} />
            </button>
          </div>
          <button
            type="button"
            onClick={add}
            disabled={complete && !inStock}
            className={buttonClass({ size: "lg", className: styles.addToBagBtn })}
            data-testid="add-to-cart"
          >
            {added ? (
              <>
                <Check size={18} />
                {t.product.added}
              </>
            ) : complete && !inStock ? (
              t.product.soldOut
            ) : (
              t.product.addToCart
            )}
          </button>
        </div>

        {inquiry && (
          <a
            href={inquiry}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass({ variant: "outline", full: true, className: styles.whatsappAskBtn })}
          >
            <WhatsAppIcon size={18} />
            {t.product.askOnWhatsApp}
          </a>
        )}

        {children}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- gallery */

function frameRatio(image: ProductImage | undefined): number {
  if (!image?.width || !image.height) return 4 / 5;
  return Math.min(2, Math.max(1 / 2, image.width / image.height));
}

function Gallery({ product, activeImageId }: { product: Product; activeImageId: string | null }) {
  const { t } = useStore();
  const images = product.images;
  const frameProps = {
    className: styles.galleryRoot,
    style: { "--ratio": frameRatio(images[0]) } as CSSProperties,
  };
  const [index, setIndex] = useState(() => Math.max(0, images.findIndex((image) => image.id === activeImageId)));
  const rail = useRef<HTMLDivElement>(null);

  // Selecting a colour with its own photo brings that photo forward…
  const [shownFor, setShownFor] = useState(activeImageId);
  if (activeImageId !== shownFor) {
    setShownFor(activeImageId);
    const target = images.findIndex((image) => image.id === activeImageId);
    if (target >= 0) setIndex(target);
  }

  // …and on phones, scrolls the swipe rail to it.
  useEffect(() => {
    const target = images.findIndex((image) => image.id === activeImageId);
    const element = rail.current?.children[target] as HTMLElement | undefined;
    if (target >= 0 && element && rail.current) {
      rail.current.scrollTo({ left: element.offsetLeft - rail.current.offsetLeft, behavior: "smooth" });
    }
  }, [activeImageId, images]);

  // With many photos the thumbnails scroll; keep the current one in view.
  const thumbs = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const list = thumbs.current;
    const item = list?.children[index];
    if (!list || !item) return;
    const outer = list.getBoundingClientRect();
    const inner = item.getBoundingClientRect();
    if (inner.left < outer.left) list.scrollBy({ left: inner.left - outer.left, behavior: "smooth" });
    else if (inner.right > outer.right) list.scrollBy({ left: inner.right - outer.right, behavior: "smooth" });
  }, [index]);

  if (images.length === 0) {
    return (
      <div {...frameProps}>
        <div className={styles.galleryFrame} />
      </div>
    );
  }

  return (
    <div {...frameProps}>
      {/* Phones: swipe between photos. */}
      <div className={styles.galleryMobileWrap}>
        <div
          ref={rail}
          className={`scrollbar-none ${styles.galleryMobileRail}`}
          onScroll={(event) => {
            const element = event.currentTarget;
            // In right-to-left languages scrollLeft counts down from 0.
            const next = Math.round(Math.abs(element.scrollLeft) / element.clientWidth);
            if (next !== index) setIndex(next);
          }}
        >
          {images.map((image, position) => (
            <div key={image.id} className={styles.galleryMobileSlide}>
              <div className={styles.galleryFrame}>
                <Image
                  src={image.url}
                  alt={imageAlt(product, image, position)}
                  fill
                  priority={position === 0}
                  sizes="100vw"
                  className={styles.galleryImgContain}
                />
              </div>
            </div>
          ))}
        </div>
        {images.length > 1 && (
          <div className={styles.galleryDots} aria-hidden="true">
            {images.map((image, position) => (
              <span
                key={image.id}
                className={`${styles.galleryDot} ${position === index ? styles.galleryDotActive : ""}`.trim()}
              />
            ))}
          </div>
        )}
      </div>

      {/* Desktop: a large photo with hover zoom, and thumbnails. */}
      <div className={styles.galleryDesktopWrap}>
        <ZoomImage image={images[index]} alt={imageAlt(product, images[index], index)} />
        {images.length > 1 && (
          <div className={styles.galleryThumbsRow}>
            <button
              type="button"
              onClick={() => setIndex((current) => (current - 1 + images.length) % images.length)}
              className={styles.galleryNavBtn}
              aria-label={t.product.previousPhoto}
            >
              <ChevronLeft size={18} className="flip-rtl" />
            </button>
            <ul ref={thumbs} className={`scrollbar-none ${styles.galleryThumbsList}`}>
              {images.map((image, position) => (
                <li key={image.id}>
                  <button
                    type="button"
                    onClick={() => setIndex(position)}
                    aria-label={t.product.photo(position + 1, images.length)}
                    aria-current={position === index}
                    className={`${styles.galleryThumbBtn} ${
                      position === index ? styles.galleryThumbBtnActive : ""
                    }`.trim()}
                  >
                    <Image src={image.url} alt="" fill sizes="80px" className={styles.imgCover} />
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setIndex((current) => (current + 1) % images.length)}
              className={styles.galleryNavBtn}
              aria-label={t.product.nextPhoto}
            >
              <ChevronRight size={18} className="flip-rtl" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Follows the pointer at 2× so the texture of a product can be seen. */
function ZoomImage({ image, alt }: { image: ProductImage; alt: string }) {
  const [origin, setOrigin] = useState<string | null>(null);
  return (
    <div
      className={`${styles.galleryFrame} ${styles.galleryZoomWrap}`}
      onPointerMove={(event) => {
        if (event.pointerType !== "mouse") return;
        const box = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - box.left) / box.width) * 100;
        const y = ((event.clientY - box.top) / box.height) * 100;
        setOrigin(`${x}% ${y}%`);
      }}
      onPointerLeave={() => setOrigin(null)}
    >
      <Image
        key={image.id}
        src={image.url}
        alt={alt}
        fill
        priority
        sizes="(min-width: 1440px) 760px, 55vw"
        className={styles.galleryZoomImg}
        style={{ transform: origin ? "scale(2)" : "scale(1)", transformOrigin: origin ?? "50% 50%" }}
      />
    </div>
  );
}
