import Link from "next/link";
import { Container } from "@/components/store/HomeSections";
import styles from "@/components/store/store.module.css";
import { buttonClass } from "@/components/ui/button";
import { getDictionary } from "@/lib/i18n";
import { getStorefront } from "@/server/storefront";

/** A wrong, old or mistyped order link: said plainly, with a 404 status. */
export default async function OrderNotFound() {
  const { settings } = await getStorefront();
  const t = getDictionary(settings.store.language);
  return (
    <Container className={styles.notFoundWrap}>
      <h1 className={`display ${styles.errorTitle}`}>{t.order.notFoundTitle}</h1>
      <p className={styles.notFoundText}>{t.order.notFoundText}</p>
      <Link href="/shop" className={buttonClass({ variant: "dark", className: styles.notFoundBtn })}>
        {t.common.continueShopping}
      </Link>
    </Container>
  );
}
