import Link from "next/link";
import { Container } from "@/components/store/HomeSections";
import styles from "@/components/store/store.module.css";
import { buttonClass } from "@/components/ui/button";
import { getDictionary } from "@/lib/i18n";
import { getStorefront } from "@/server/storefront";

export default async function NotFound() {
  let language: Parameters<typeof getDictionary>[0] = "en";
  try {
    language = (await getStorefront()).settings.store.language;
  } catch {
    // The layout already handles a store that cannot load.
  }
  const t = getDictionary(language);
  return (
    <Container className={styles.notFoundWrap}>
      <p className={`price ${styles.notFoundCode}`}>404</p>
      <h1 className={`display ${styles.notFoundTitle}`}>{t.notFound.title}</h1>
      <p className={styles.notFoundText}>{t.notFound.text}</p>
      <Link href="/shop" className={buttonClass({ variant: "dark", className: styles.notFoundBtn })}>
        {t.notFound.cta}
      </Link>
    </Container>
  );
}
