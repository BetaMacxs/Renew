import { Banknote, Landmark, Truck } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { WhatsAppIcon } from "@/components/icons/brands";
import { Container, ProductRow } from "@/components/store/HomeSections";
import { ProductView } from "@/components/store/ProductView";
import { RichText } from "@/components/store/RichText";
import styles from "@/components/store/store.module.css";
import { buttonClass } from "@/components/ui/button";
import { sortProducts, storefrontProducts } from "@/lib/domain/catalog-query";
import { formatMoney } from "@/lib/domain/money";
import { isVariantInStock, primaryImage } from "@/lib/domain/product";
import { enabledCheckoutMethods, moneyFormatOf } from "@/lib/domain/settings";
import type { Product } from "@/lib/domain/types";
import { getDictionary } from "@/lib/i18n";
import { siteOrigin } from "@/server/request";
import { getStorefront } from "@/server/storefront";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ variant?: string | string[] }> };

async function load(slug: string) {
  const data = await getStorefront();
  const visible = storefrontProducts(data.catalog);
  const product =
    visible.find((candidate) => candidate.slug === slug) ??
    data.catalog.products.find((candidate) => candidate.slug === slug && candidate.status === "archived") ??
    null;
  return { ...data, product, visible };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { product } = await load((await params).slug);
  if (!product) return {};
  const image = primaryImage(product);
  const description = product.seoDescription || product.summary || product.description.slice(0, 160);
  return {
    title: product.seoTitle || product.name,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      type: "website",
      title: product.name,
      description,
      images: image ? [{ url: image.url, width: image.width ?? undefined, height: image.height ?? undefined }] : undefined,
    },
    robots: product.status === "archived" ? { index: false, follow: true } : undefined,
  };
}

function related(product: Product, pool: Product[]): Product[] {
  const others = pool.filter((candidate) => candidate.id !== product.id);
  const score = (candidate: Product) =>
    (candidate.categoryId === product.categoryId ? 2 : 0) +
    candidate.collectionIds.filter((id) => product.collectionIds.includes(id)).length;
  return sortProducts(others)
    .map((candidate) => ({ candidate, score: score(candidate) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((entry) => entry.candidate);
}

export default async function ProductPage({ params, searchParams }: Props) {
  const { settings, catalog, product, visible } = await load((await params).slug);
  const { variant } = await searchParams;
  if (!product) notFound();

  const t = getDictionary(settings.store.language);
  const money = moneyFormatOf(settings);
  const origin = await siteOrigin(settings);
  const category = catalog.categories.find((candidate) => candidate.id === product.categoryId) ?? null;
  const alternatives = related(product, visible);

  if (product.status === "archived") {
    const image = primaryImage(product);
    return (
      <Container className={styles.archivedWrap}>
        <div className={styles.archivedCard}>
          {image && (
            <div className={styles.archivedThumb}>
              <Image src={image.url} alt={product.name} fill sizes="12rem" className={styles.archivedImg} />
            </div>
          )}
          <div>
            <p className="eyebrow">{product.name}</p>
            <h1 className={`display ${styles.archivedHeading}`}>{t.product.noLongerAvailable}</h1>
            <p className={styles.archivedText}>{t.product.noLongerAvailableText}</p>
            <Link href="/shop" className={buttonClass({ variant: "dark", className: styles.archivedBtn })}>
              {t.notFound.cta}
            </Link>
          </div>
        </div>
        <ProductRow title={t.product.related} products={alternatives} money={money} t={t} />
      </Container>
    );
  }

  /* --------------------------------------------------- structured data */
  const prices = product.variants.map((variant) => variant.price);
  const available = product.variants.some((variant) => isVariantInStock(product, variant));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.summary || product.description,
    image: product.images.map((image) => new URL(image.url, origin).toString()),
    sku: product.variants[0]?.sku || undefined,
    brand: { "@type": "Brand", name: settings.store.name },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: settings.store.currency,
      lowPrice: Math.min(...prices),
      highPrice: Math.max(...prices),
      offerCount: product.variants.length,
      availability: available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${origin}/products/${product.slug}`,
    },
  };

  /* ---------------------------------------------- delivery and payment */
  const threshold = settings.shipping.freeShippingThreshold;
  const methods = enabledCheckoutMethods(settings);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <Container className={styles.productPageTop}>
        <nav aria-label="Breadcrumb" className={styles.breadcrumbNav}>
          <ol className={styles.breadcrumbList}>
            <li>
              <Link href="/" className={styles.breadcrumbLink}>
                {t.common.home}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/shop" className={styles.breadcrumbLink}>
                {t.nav.shop}
              </Link>
            </li>
            {category && (
              <>
                <li aria-hidden="true">/</li>
                <li>
                  <Link href={`/categories/${category.slug}`} className={styles.breadcrumbLink}>
                    {category.name}
                  </Link>
                </li>
              </>
            )}
          </ol>
        </nav>

        <ProductView
          key={`${product.id}:${typeof variant === "string" ? variant : ""}`}
          product={product}
          productUrl={`${origin}/products/${product.slug}`}
          category={category ? { name: category.name, slug: category.slug } : null}
          variantId={typeof variant === "string" ? variant : null}
        >
          <div className={styles.productExtras}>
            {product.description && (
              <section>
                <h2 className={`eyebrow ${styles.productExtraEyebrow}`}>{t.product.description}</h2>
                <RichText text={product.description} />
              </section>
            )}

            {product.specs.length > 0 && (
              <section>
                <h2 className={`eyebrow ${styles.productExtraEyebrow}`}>{t.product.details}</h2>
                <dl className={styles.specsList}>
                  {product.specs.map((spec) => (
                    <div key={spec.label} className={styles.specsRow}>
                      <dt className={styles.specsLabel}>{spec.label}</dt>
                      <dd>{spec.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            <section className={styles.deliveryBox}>
              <h2 className={`eyebrow ${styles.deliveryTitle}`}>{t.product.deliveryTitle}</h2>
              <ul className={styles.deliveryList}>
                {settings.shipping.methods.map((method) => (
                  <li key={method.id} className={styles.deliveryItem}>
                    <Truck size={18} strokeWidth={1.6} className={styles.deliveryIcon} />
                    <span>
                      <span className={styles.deliveryName}>{method.name}</span>
                      <span className={`price ${styles.deliveryPrice}`}>
                        {method.price > 0 ? formatMoney(method.price, money) : t.checkout.free}
                      </span>
                      {method.description && <span className={styles.deliveryDesc}>{method.description}</span>}
                    </span>
                  </li>
                ))}
                {threshold && (
                  <li className={styles.deliveryThreshold}>
                    {t.highlights.freeShippingOver(formatMoney(threshold, money))}
                  </li>
                )}
                {methods.map((method) => (
                  <li key={method} className={styles.deliveryItem}>
                    {method === "cod" ? (
                      <Banknote size={18} strokeWidth={1.6} className={styles.deliveryIcon} />
                    ) : method === "bank_transfer" ? (
                      <Landmark size={18} strokeWidth={1.6} className={styles.deliveryIcon} />
                    ) : (
                      <WhatsAppIcon size={17} className={styles.deliveryIcon} />
                    )}
                    <span>
                      {method === "cod" ? t.highlights.cod : method === "bank_transfer" ? t.highlights.bank : t.highlights.whatsapp}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </ProductView>
      </Container>

      <ProductRow title={t.product.related} products={alternatives} money={money} t={t} />
    </>
  );
}
