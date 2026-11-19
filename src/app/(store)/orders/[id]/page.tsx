import { CircleAlert, CircleCheck, Clock, PackageCheck } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WhatsAppIcon } from "@/components/icons/brands";
import { DemoNotice } from "@/components/store/Demo";
import { Container } from "@/components/store/HomeSections";
import { Receipt, ReceiptLine, ReceiptRule } from "@/components/store/Receipt";
import { RichText } from "@/components/store/RichText";
import { WhatsAppHandoff } from "@/components/store/WhatsAppHandoff";
import styles from "@/components/store/store.module.css";
import { formatMoney, includedVatAmount } from "@/lib/domain/money";
import { isWhatsAppHandoff } from "@/lib/domain/orders";
import { isWhatsAppConfigured, moneyFormatOf } from "@/lib/domain/settings";
import type { Order } from "@/lib/domain/types";
import { buildOrderMessage, whatsappUrl } from "@/lib/domain/whatsapp";
import { getDictionary, intlLocaleOf } from "@/lib/i18n";
import { getBackend } from "@/server/backend";
import { sha256 } from "@/server/crypto";
import { publicDemoMode } from "@/server/env";
import { getStorefront } from "@/server/storefront";

/**
 * A shopper's own order, reachable only through the secret link they were
 * given at checkout (the store keeps just a hash of it). No account needed —
 * bookmark the page to follow the order.
 */

export const metadata: Metadata = { robots: { index: false, follow: false } };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ key?: string | string[] }>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY = /^[A-Za-z0-9_-]{20,128}$/;

async function findOrder(id: string, key: string | undefined): Promise<Order | null> {
  if (!UUID.test(id) || !key || !KEY.test(key)) return null;
  try {
    return await getBackend().public.findCustomerOrder(id, sha256(key));
  } catch {
    return null;
  }
}

const STEPS = ["received", "confirmed", "fulfilled", "completed"] as const;

export default async function OrderPage({ params, searchParams }: Props) {
  const { id } = await params;
  const rawKey = (await searchParams).key;
  const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;
  const { settings } = await getStorefront();
  const t = getDictionary(settings.store.language);
  const money = moneyFormatOf(settings);
  const order = await findOrder(id, key);

  // A wrong or incomplete link gets the same answer as no order at all.
  if (!order || !key) notFound();

  const demoNotice = publicDemoMode() ? (
    <div className={styles.orderDemoWrap}>
      <DemoNotice>{t.demo.order}</DemoNotice>
    </div>
  ) : null;
  const configured = isWhatsAppConfigured(settings);
  const handoff = isWhatsAppHandoff(order);
  const placed = new Intl.DateTimeFormat(intlLocaleOf(settings.store.language), {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(order.createdAt));

  const contactUrl = configured
    ? whatsappUrl(settings.contact.whatsapp, `${t.order.number(order.number)} — `)
    : null;

  const receipt = (
    <Receipt title={t.order.itemsTitle}>
      {order.items.map((item, index) => (
        <ReceiptLine
          key={`${item.variantId}-${index}`}
          label={`${item.quantity} × ${item.name}`}
          detail={item.variantLabel || undefined}
          amount={formatMoney(item.lineTotal, money, "full")}
        />
      ))}
      <ReceiptRule />
      <ReceiptLine label={t.cart.subtotal} amount={formatMoney(order.subtotal, money, "full")} />
      <ReceiptLine
        label={order.shippingMethod ? `${t.cart.shipping} · ${order.shippingMethod.name}` : t.cart.shipping}
        amount={order.shippingFee > 0 ? formatMoney(order.shippingFee, money, "full") : t.checkout.free}
      />
      <ReceiptRule />
      <ReceiptLine label={t.cart.total} amount={formatMoney(order.total, money, "full")} strong />
      {settings.checkout.vatEnabled && settings.checkout.vatRate > 0 && (
        <ReceiptLine
          label={t.cart.vatIncluded(settings.checkout.vatRate, settings.checkout.vatNumber || undefined)}
          amount={formatMoney(includedVatAmount(order.total, settings.checkout.vatRate), money, "full")}
          muted
        />
      )}
    </Receipt>
  );

  if (handoff) {
    const message = buildOrderMessage(order, { storeName: settings.store.name, money, labels: t.whatsapp });
    return (
      <Container className={styles.pageTop}>
        <div className={styles.orderGrid}>
          <div>
            {demoNotice}
            <p className="eyebrow">{t.order.number(order.number)}</p>
            <h1 className={`display ${styles.orderTitle}`}>
              {configured ? t.order.whatsappReadyTitle : t.order.whatsappDemoTitle}
            </h1>
            <p className={styles.orderIntro}>
              {configured ? t.order.whatsappReadyText : t.order.whatsappDemoText}
            </p>
            <div className={styles.orderHandoffWrap}>
              <WhatsAppHandoff
                url={configured ? whatsappUrl(settings.contact.whatsapp, message) : null}
                message={message}
                orderId={order.id}
                accessKey={key}
              />
            </div>
          </div>
          <div className={styles.orderReceiptTop}>{receipt}</div>
        </div>
      </Container>
    );
  }

  const stepIndex = STEPS.indexOf(order.status as (typeof STEPS)[number]);
  const cancelled = order.status === "cancelled" || order.status === "discarded";

  return (
    <Container className={styles.pageTop}>
      <div className={styles.orderGrid}>
        <div className={styles.orderMain}>
          <header>
            {demoNotice}
            <p className="eyebrow">
              {t.order.number(order.number)} · {t.order.placedOn(placed)}
            </p>
            <h1 className={`display ${styles.orderTitle}`}>{t.order.thanks}</h1>
            {settings.checkout.confirmationNote && (
              <p className={styles.orderIntro}>{settings.checkout.confirmationNote}</p>
            )}
          </header>

          <section>
            <h2 className={`eyebrow ${styles.orderStatusHeading}`}>{t.order.statusTitle}</h2>
            {cancelled ? (
              <p className={styles.orderStatusCancelled}>
                <CircleAlert size={18} />
                {t.order.customerStatus[order.status]}
              </p>
            ) : (
              <ol className={styles.orderStepsGrid} data-testid="order-status">
                {STEPS.map((step, index) => {
                  const done = index <= stepIndex;
                  return (
                    <li
                      key={step}
                      className={`${styles.orderStepCard} ${
                        index === stepIndex ? styles.orderStepCurrent : !done ? styles.orderStepMuted : ""
                      }`.trim()}
                    >
                      {done ? (
                        index === stepIndex ? (
                          <Clock size={17} className={styles.orderStepIcon} />
                        ) : (
                          <CircleCheck size={17} className={`${styles.orderStepIcon} ${styles.orderStepSuccess}`} />
                        )
                      ) : (
                        <PackageCheck size={17} className={styles.orderStepIcon} />
                      )}
                      <span>{t.order.customerStatus[step]}</span>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <section className={styles.orderSectionGrid2}>
            <div>
              <h2 className={`eyebrow ${styles.orderSectionEyebrow}`}>{t.order.paymentTitle}</h2>
              <p className={styles.orderStrongText}>
                {order.paymentStatus === "paid" ? t.order.paymentPaid : t.order.paymentUnpaid[order.paymentMethod]}
              </p>
              {order.paymentMethod === "bank_transfer" && order.paymentStatus !== "paid" && !cancelled && (
                <div className={styles.orderBankBox}>
                  <p className={styles.orderBankTitle}>{t.order.bankDetails}</p>
                  {settings.checkout.bankTransferInstructions ? (
                    <RichText text={settings.checkout.bankTransferInstructions} className={styles.orderBankRich} />
                  ) : null}
                  <p className={styles.orderBankRef}>{t.order.bankReference(order.number)}</p>
                </div>
              )}
            </div>
            <div>
              <h2 className={`eyebrow ${styles.orderSectionEyebrow}`}>{t.order.deliveryTitle}</h2>
              <p className={styles.orderStrongText}>{order.customer.name}</p>
              {order.shippingMethod && <p className={styles.orderMutedText}>{order.shippingMethod.name}</p>}
              {order.address ? (
                <p className={styles.orderMutedText}>
                  {[order.address.line1, order.address.city, order.address.region, order.address.postalCode, order.address.country]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              ) : (
                <p className={styles.orderMutedText}>{t.order.pickup}</p>
              )}
            </div>
          </section>

          <section className={styles.orderKeepBox}>
            <p className={styles.orderKeepTitle}>{t.order.keepLink}</p>
            {(contactUrl || settings.contact.email) && (
              <div className={styles.orderKeepLinks}>
                <span>{t.order.questions}</span>
                {contactUrl && (
                  <a href={contactUrl} target="_blank" rel="noopener noreferrer" className={styles.orderKeepLink}>
                    <WhatsAppIcon size={15} /> WhatsApp
                  </a>
                )}
                {settings.contact.email && (
                  <a href={`mailto:${settings.contact.email}?subject=${encodeURIComponent(t.order.number(order.number))}`} className={styles.orderKeepLink}>
                    {settings.contact.email}
                  </a>
                )}
              </div>
            )}
          </section>
        </div>
        <div>{receipt}</div>
      </div>
    </Container>
  );
}
