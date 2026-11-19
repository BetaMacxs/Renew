import type { Metadata } from "next";
import { AdoptHandedOffCart } from "@/components/store/AdoptHandedOffCart";
import { CheckoutForm } from "@/components/store/CheckoutForm";
import { DemoNotice } from "@/components/store/Demo";
import { Container } from "@/components/store/HomeSections";
import styles from "@/components/store/store.module.css";
import { getDictionary } from "@/lib/i18n";
import { publicDemoMode } from "@/server/env";
import { issueFormToken } from "@/server/form-token";
import { getStorefront } from "@/server/storefront";

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getStorefront();
  return { title: getDictionary(settings.store.language).checkout.title, robots: { index: false } };
}

export default async function CheckoutPage() {
  const { settings } = await getStorefront();
  const t = getDictionary(settings.store.language);
  return (
    <Container className={styles.pageTop}>
      <h1 className={`display ${styles.checkoutHeading}`}>{t.checkout.title}</h1>
      {publicDemoMode() && (
        <div className={styles.checkoutDemoWrap}>
          <DemoNotice>{t.demo.checkout}</DemoNotice>
        </div>
      )}
      {publicDemoMode() && <AdoptHandedOffCart />}
      <CheckoutForm formToken={await issueFormToken()} />
    </Container>
  );
}
