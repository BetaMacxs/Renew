import { ArrowLeft, Mail, Phone } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { WhatsAppIcon } from "@/components/icons/brands";
import styles from "@/components/admin/admin.module.css";
import { AnonymizeOrderButton, DeleteOrderButton, InternalNote, OrderStatusActions, PaymentStatusControl } from "@/components/admin/OrderActions";
import { ChannelBadge, formatDateTime, OrderStatusPill, PaymentPill } from "@/components/admin/OrderBits";
import { Notice, PageHeader, Panel } from "@/components/admin/ui";
import { formatMoney, includedVatAmount } from "@/lib/domain/money";
import { ORDER_STATUS_META, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/domain/orders";
import { normalizePhone } from "@/lib/domain/phone";
import type { OrderEvent } from "@/lib/domain/types";
import { whatsappUrl } from "@/lib/domain/whatsapp";
import { requireAdmin } from "@/server/admin";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `Order ${(await params).id.slice(0, 8)}` };
}

function describe(event: OrderEvent): string {
  switch (event.kind) {
    case "created":
      return event.note ?? "Order created";
    case "status":
      return `${event.from ? `${ORDER_STATUS_META[event.from as keyof typeof ORDER_STATUS_META]?.label ?? event.from} → ` : ""}${
        ORDER_STATUS_META[event.to as keyof typeof ORDER_STATUS_META]?.label ?? event.to
      }`;
    case "payment":
      return `Payment: ${PAYMENT_STATUS_LABELS[event.to as keyof typeof PAYMENT_STATUS_LABELS] ?? event.to}`;
    case "stock":
      return event.note ?? "Stock updated";
    default:
      return event.note ?? event.kind;
  }
}

export default async function OrderDetailPage({ params }: Props) {
  const admin = await requireAdmin();
  const [order, settings] = await Promise.all([admin.getOrder((await params).id), admin.loadSettings()]);
  if (!order) notFound();
  const money = { currency: order.currency, locale: "en" };
  const meta = ORDER_STATUS_META[order.status];
  const phoneDigits = normalizePhone(order.customer.phone);
  const chatUrl =
    phoneDigits.length >= 8
      ? whatsappUrl(phoneDigits, `Hello ${order.customer.name.split(" ")[0]}, this is ${settings.store.name} about your order #${order.number}.`)
      : null;

  return (
    <>
      <PageHeader
        back={
          <Link href="/admin/orders" className={styles.backLink}>
            <ArrowLeft size={15} /> Orders
          </Link>
        }
        title={`Order #${order.number}`}
        description={
          <span className={styles.orderHeaderMeta}>
            <OrderStatusPill status={order.status} />
            <ChannelBadge channel={order.channel} />
            <span>{formatDateTime(order.createdAt)}</span>
          </span>
        }
      />

      <Panel className={styles.mb6}>
        <div className={styles.orderStatusBanner}>
          <div>
            <p className={styles.orderStatusTitle}>{meta.label}</p>
            <p className={styles.orderStatusDesc}>{meta.description}</p>
          </div>
          <OrderStatusActions order={order} />
        </div>
        {(order.status === "prepared" || order.status === "opened") && (
          <div className={styles.mt4}>
            <Notice tone="warning">
              Look in your WhatsApp chats for a message starting with “<strong>Order #{order.number}</strong>”. Mark it as
              received only once you have it. If it never arrives, discard the handoff.
            </Notice>
          </div>
        )}
      </Panel>

      <div className={styles.orderDetailGrid}>
        <div className={styles.stack6}>
          <Panel title="Items" padded={false}>
            <ul className={styles.dividerList}>
              {order.items.map((item, index) => (
                <li key={`${item.variantId}-${index}`} className={styles.orderItemRow}>
                  <span className={styles.thumb56}>
                    {item.imageUrl && <Image src={item.imageUrl} alt="" fill sizes="56px" className={styles.imageCover} />}
                  </span>
                  <span className={styles.orderItemBody}>
                    {item.productId ? (
                      <Link href={`/admin/products/${item.productId}`} className={styles.orderItemNameLink}>
                        {item.name}
                      </Link>
                    ) : (
                      <span className={styles.orderItemName}>{item.name}</span>
                    )}
                    <span className={styles.orderItemSub}>
                      {[item.variantLabel, `${formatMoney(item.unitPrice, money, "full")} × ${item.quantity}`].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="mono">{formatMoney(item.lineTotal, money, "full")}</span>
                </li>
              ))}
            </ul>
            <dl className={styles.orderTotals}>
              <div className={styles.orderTotalRow}>
                <dt className={styles.mutedText}>Subtotal</dt>
                <dd className="mono">{formatMoney(order.subtotal, money, "full")}</dd>
              </div>
              <div className={styles.orderTotalRow}>
                <dt className={styles.mutedText}>Delivery{order.shippingMethod ? ` · ${order.shippingMethod.name}` : ""}</dt>
                <dd className="mono">{order.shippingFee > 0 ? formatMoney(order.shippingFee, money, "full") : "Free"}</dd>
              </div>
              <div className={styles.orderTotalGrand}>
                <dt>Total</dt>
                <dd className="mono">{formatMoney(order.total, money, "full")}</dd>
              </div>
              {settings.checkout.vatEnabled && settings.checkout.vatRate > 0 && (
                <div className={styles.orderTotalRow}>
                  <dt className={styles.mutedText}>
                    Includes {settings.checkout.vatRate}% VAT
                    {settings.checkout.vatNumber ? ` (${settings.checkout.vatNumber})` : ""}
                  </dt>
                  <dd className={`mono ${styles.mutedText}`}>
                    {formatMoney(includedVatAmount(order.total, settings.checkout.vatRate), money, "full")}
                  </dd>
                </div>
              )}
            </dl>
          </Panel>

          {order.customerNote && (
            <Panel title="Note from the customer">
              <p className={styles.customerNoteText}>{order.customerNote}</p>
            </Panel>
          )}

          <Panel title="History">
            <ol className={styles.timeline}>
              {[...order.events].reverse().map((event, index) => (
                <li key={`${event.at}-${index}`} className={styles.timelineItem}>
                  <span className={styles.timelineDot} />
                  <p className={styles.timelineTitle}>{describe(event)}</p>
                  {event.kind === "status" && event.note && <p className={styles.timelineNote}>“{event.note}”</p>}
                  <p className={styles.timelineMeta}>
                    {formatDateTime(event.at)} · {event.by === "customer" ? "Customer" : event.by}
                  </p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className={styles.stack6}>
          <Panel title="Customer">
            <p className={styles.strongText}>{order.customer.name}</p>
            <ul className={styles.customerContactList}>
              {order.customer.phone && (
                <li className={styles.customerContactRow}>
                  <Phone size={15} className={styles.customerContactIcon} />
                  <a href={`tel:${order.customer.phone.replace(/[^\d+]/g, "")}`} className={styles.customerContactLink} dir="ltr">
                    {order.customer.phone}
                  </a>
                </li>
              )}
              {order.customer.email && (
                <li className={styles.customerContactRow}>
                  <Mail size={15} className={styles.customerContactIcon} />
                  <a href={`mailto:${order.customer.email}`} className={styles.customerContactLink}>
                    {order.customer.email}
                  </a>
                </li>
              )}
            </ul>
            {chatUrl && (
              <a href={chatUrl} target="_blank" rel="noopener noreferrer" className={styles.whatsappChatLink}>
                <WhatsAppIcon size={16} /> Message on WhatsApp
              </a>
            )}
          </Panel>

          <Panel title="Delivery">
            <p className={styles.strongText}>{order.shippingMethod?.name ?? "—"}</p>
            {order.address ? (
              <address className={styles.addressBlock}>
                {order.address.line1}
                <br />
                {[order.address.postalCode, order.address.city].filter(Boolean).join(" ")}
                {order.address.region && (
                  <>
                    <br />
                    {order.address.region}
                  </>
                )}
                {order.address.country && (
                  <>
                    <br />
                    {order.address.country}
                  </>
                )}
              </address>
            ) : (
              <p className={`${styles.mt2} ${styles.mutedText}`}>No address needed (pickup).</p>
            )}
          </Panel>

          <Panel title="Payment">
            <div className={styles.paymentHeader}>
              <p className={styles.mutedText}>{PAYMENT_METHOD_LABELS[order.paymentMethod]}</p>
              <PaymentPill order={order} />
            </div>
            <div className={styles.mt4}>
              <PaymentStatusControl order={order} />
            </div>
          </Panel>

          <Panel>
            <InternalNote order={order} />
          </Panel>

          <div className={styles.flexEnd}>
            <AnonymizeOrderButton order={order} />
            <DeleteOrderButton order={order} />
          </div>
        </div>
      </div>
    </>
  );
}
