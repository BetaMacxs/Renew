import { ArrowRight, Check, CircleDashed, PackageX, ReceiptText, Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { WhatsAppIcon } from "@/components/icons/brands";
import styles from "@/components/admin/admin.module.css";
import { ChannelBadge, formatRelative, OrderStatusPill } from "@/components/admin/OrderBits";
import { SalesChart } from "@/components/admin/SalesChart";
import { EmptyState, Notice, PageHeader, Panel } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";
import { formatMoney, type MoneyFormat } from "@/lib/domain/money";
import { orderMetrics } from "@/lib/domain/orders";
import { stockIssue } from "@/lib/domain/product";
import { detectDemoSettings } from "@/lib/demo/seed";
import { DEFAULT_SETTINGS, isWhatsAppConfigured } from "@/lib/domain/settings";
import { requireAdmin } from "@/server/admin";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage() {
  const admin = await requireAdmin();
  const now = new Date();
  const since = new Date(now);
  since.setUTCDate(since.getUTCDate() - 30);

  const [settings, catalog, recentWindow, recent] = await Promise.all([
    admin.loadSettings(),
    admin.loadCatalog(),
    admin.ordersSince(since.toISOString()),
    admin.listOrders({ limit: 6, offset: 0 }),
  ]);
  // Handoffs and unconfirmed orders older than 30 days still need attention.
  const open = await admin.listOrders({ statuses: ["received", "confirmed", "prepared", "opened"], limit: 500, offset: 0 });
  const metrics = orderMetrics([...recentWindow, ...open.orders.filter((order) => order.createdAt < since.toISOString())], now);
  const money: MoneyFormat = { currency: settings.store.currency, locale: "en" };

  const active = catalog.products.filter((product) => product.status === "active");
  const drafts = catalog.products.filter((product) => product.status === "draft").length;
  const soldOut = active.filter((product) => stockIssue(product) === "sold-out");
  const low = active.filter((product) => stockIssue(product) === "low");
  const demoProducts = catalog.products.filter((product) => product.isDemo).length;
  const ownProducts = catalog.products.length - demoProducts;
  const demoSettingsHits = detectDemoSettings(settings);

  const checklist = [
    { done: settings.store.name !== DEFAULT_SETTINGS.store.name, label: "Name your store and add a logo", href: "/admin/settings#store" },
    {
      done: isWhatsAppConfigured(settings) || Boolean(settings.contact.email || settings.contact.phone),
      label: "Add your WhatsApp number or contact email",
      href: "/admin/settings#contact",
    },
    {
      done: JSON.stringify(settings.shipping.methods) !== JSON.stringify(DEFAULT_SETTINGS.shipping.methods),
      label: "Set your delivery options and prices",
      href: "/admin/settings#delivery",
    },
    { done: ownProducts > 0, label: "Add your first product", href: "/admin/products/new" },
    { done: demoProducts === 0, label: "Remove the demo products when you're ready", href: "/admin/settings#demo" },
  ];
  const remaining = checklist.filter((item) => !item.done).length;

  const attention = [
    {
      count: metrics.toConfirm,
      label: metrics.toConfirm === 1 ? "order to confirm" : "orders to confirm",
      hint: "Website orders and verified WhatsApp orders waiting for you.",
      href: "/admin/orders?view=new",
      icon: <ReceiptText size={20} />,
    },
    {
      count: metrics.handoffsToVerify,
      label: metrics.handoffsToVerify === 1 ? "WhatsApp handoff to check" : "WhatsApp handoffs to check",
      hint: "Shoppers who opened WhatsApp. Match them with your chats.",
      href: "/admin/orders?view=whatsapp",
      icon: <WhatsAppIcon size={19} />,
    },
    {
      count: metrics.toFulfill,
      label: metrics.toFulfill === 1 ? "order to send" : "orders to send",
      hint: "Confirmed and waiting to be shipped or collected.",
      href: "/admin/orders?view=confirmed",
      icon: <Truck size={20} />,
    },
    {
      count: soldOut.length + low.length,
      label: "products low or out of stock",
      hint: soldOut.length > 0 ? `${soldOut.length} sold out, ${low.length} running low.` : `${low.length} running low.`,
      href: "/admin/products?view=stock",
      icon: <PackageX size={20} />,
    },
  ];

  return (
    <>
      <PageHeader
        title={`Hello, ${settings.store.name}`}
        description="What needs doing in your store today."
        actions={
          <Link href="/admin/products/new" className={buttonClass()}>
            Add product
          </Link>
        }
      />

      {demoProducts > 0 && (
        <div className={styles.mb6}>
          <Notice
            tone="info"
            title={`Your store is showing ${demoProducts} demo products`}
            action={
              <Link href="/admin/settings#demo" className={styles.textLink}>
                Manage
              </Link>
            }
          >
            They&apos;re here so the shop looks complete while you set up. Remove them all in one click once your own
            products are in.
          </Notice>
        </div>
      )}

      {demoProducts === 0 && demoSettingsHits.length > 0 && (
        <div className={styles.mb6}>
          <Notice
            tone="warning"
            title="Sample demo settings are still visible on your storefront"
            action={
              <Link href="/admin/settings#demo" className={styles.textLink}>
                Clean demo settings
              </Link>
            }
          >
            Detected: {demoSettingsHits.join(", ")}. Clear them before going live.
          </Notice>
        </div>
      )}

      <div className={styles.attentionGrid}>
        {attention.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.attentionCard} ${item.count > 0 ? styles.attentionCardActive : styles.attentionCardMuted}`}
          >
            <div className={styles.attentionTop}>
              <span className={item.count > 0 ? styles.attentionIconActive : styles.attentionIconMuted}>{item.icon}</span>
              <ArrowRight size={16} className={styles.attentionArrow} />
            </div>
            <p className={`price ${styles.attentionCount}`}>{item.count}</p>
            <p className={styles.attentionLabel}>{item.label}</p>
            <p className={styles.attentionHint}>{item.hint}</p>
          </Link>
        ))}
      </div>

      <div className={styles.overviewSplit}>
        <Panel
          title="Confirmed sales · last 30 days"
          description="Only orders you confirmed count. WhatsApp handoffs and unconfirmed orders never do."
        >
          <div className={styles.salesTotals}>
            <div>
              <p className={`price ${styles.salesPrimary}`}>{formatMoney(metrics.salesTotal, money, "full")}</p>
              <p className={styles.salesSub}>
                {metrics.salesCount} {metrics.salesCount === 1 ? "order" : "orders"}
              </p>
            </div>
            <div>
              <p className={`price ${styles.salesSecondary}`}>{formatMoney(metrics.paidTotal, money, "full")}</p>
              <p className={styles.salesSub}>marked as paid</p>
            </div>
          </div>
          {metrics.salesCount > 0 ? (
            <SalesChart daily={metrics.daily} money={money} />
          ) : (
            <p className={styles.salesEmpty}>
              No confirmed orders yet. When you confirm an order, it shows up here.
            </p>
          )}
        </Panel>

        {remaining > 0 ? (
          <Panel title="Set up your store" description={`${checklist.length - remaining} of ${checklist.length} done`}>
            <ul className={styles.checklist}>
              {checklist.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className={styles.checklistItem}>
                    {item.done ? (
                      <span className={styles.checkCircle}>
                        <Check size={13} strokeWidth={3} />
                      </span>
                    ) : (
                      <CircleDashed size={20} className={styles.checkDashed} />
                    )}
                    <span className={item.done ? styles.checkLabelDone : styles.checkLabelTodo}>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        ) : (
          <Panel title="Catalog">
            <dl className={styles.catalogStats}>
              <div>
                <dt className={styles.catalogStatLabel}>Live products</dt>
                <dd className={`price ${styles.catalogStatValue}`}>{active.length}</dd>
              </div>
              <div>
                <dt className={styles.catalogStatLabel}>Drafts</dt>
                <dd className={`price ${styles.catalogStatValue}`}>{drafts}</dd>
              </div>
            </dl>
          </Panel>
        )}
      </div>

      <Panel
        className={styles.mt6}
        padded={false}
        title="Latest orders"
        actions={
          <Link href="/admin/orders" className={styles.textLink}>
            All orders
          </Link>
        }
      >
        {recent.orders.length === 0 ? (
          <EmptyState icon={<ReceiptText size={20} />} title="No orders yet">
            Orders placed on your website, and WhatsApp orders customers start, will appear here.
          </EmptyState>
        ) : (
          <ul className={styles.dividerList}>
            {recent.orders.map((order) => (
              <li key={order.id}>
                <Link href={`/admin/orders/${order.id}`} className={styles.recentRow}>
                  <span className={`mono ${styles.recentNumber}`}>#{order.number}</span>
                  <span className={styles.recentMain}>
                    <span className={styles.recentName}>{order.customer.name}</span>
                    <span className={styles.recentMeta}>
                      <ChannelBadge channel={order.channel} /> {formatRelative(order.createdAt, now.getTime())}
                    </span>
                  </span>
                  <span className={styles.recentStatus}>
                    <OrderStatusPill status={order.status} />
                  </span>
                  <span className="mono">{formatMoney(order.total, money, "full")}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
