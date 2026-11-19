import { ReceiptText, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/components/admin/admin.module.css";
import { ChannelBadge, formatRelative, OrderStatusPill, PaymentPill } from "@/components/admin/OrderBits";
import { DiscardStaleButton } from "@/components/admin/OrderListActions";
import { EmptyState, Notice, PageHeader, Panel } from "@/components/admin/ui";
import { formatMoney } from "@/lib/domain/money";
import { isStaleHandoff } from "@/lib/domain/orders";
import type { OrderStatus } from "@/lib/domain/types";
import { requireAdmin } from "@/server/admin";

export const metadata: Metadata = { title: "Orders" };

const VIEWS: { key: string; label: string; statuses?: OrderStatus[] }[] = [
  { key: "new", label: "To confirm", statuses: ["received"] },
  { key: "whatsapp", label: "WhatsApp handoffs", statuses: ["prepared", "opened"] },
  { key: "confirmed", label: "To send", statuses: ["confirmed"] },
  { key: "fulfilled", label: "Sent", statuses: ["fulfilled"] },
  { key: "completed", label: "Completed", statuses: ["completed"] },
  { key: "closed", label: "Cancelled", statuses: ["cancelled", "discarded"] },
  { key: "all", label: "All" },
];

const PAGE_SIZE = 25;

type Props = { searchParams: Promise<{ view?: string; q?: string; page?: string }> };

export default async function OrdersPage({ searchParams }: Props) {
  const params = await searchParams;
  const admin = await requireAdmin();
  const view = VIEWS.find((candidate) => candidate.key === params.view) ?? VIEWS[0];
  const page = Math.max(1, Number(params.page) || 1);
  const search = params.q?.trim().slice(0, 80) ?? "";

  const [settings, counts, list] = await Promise.all([
    admin.loadSettings(),
    admin.orderStatusCounts(),
    admin.listOrders({ statuses: view.statuses, search, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
  ]);
  const money = { currency: settings.store.currency, locale: "en" };
  const now = new Date();
  const countFor = (statuses?: OrderStatus[]) =>
    statuses ? statuses.reduce((total, status) => total + counts[status], 0) : Object.values(counts).reduce((a, b) => a + b, 0);
  const staleCount =
    view.key === "whatsapp"
      ? (await admin.listOrders({ statuses: ["prepared", "opened"], limit: 1000, offset: 0 })).orders.filter((order) =>
          isStaleHandoff(order, now),
        ).length
      : 0;
  const pages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));
  const href = (next: Record<string, string | number | undefined>) => {
    const query = new URLSearchParams();
    const merged = { view: view.key, q: search || undefined, ...next };
    for (const [key, value] of Object.entries(merged)) if (value !== undefined && value !== "") query.set(key, String(value));
    return `/admin/orders?${query.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Orders"
        description="Website orders arrive here as soon as they're placed. WhatsApp orders appear first as unverified handoffs."
      />

      <div className={styles.toolbar}>
        <nav className={`scrollbar-none ${styles.tabsScroll}`} aria-label="Order views">
          {VIEWS.map((candidate) => {
            const active = candidate.key === view.key;
            const count = countFor(candidate.statuses);
            return (
              <Link
                key={candidate.key}
                href={href({ view: candidate.key, page: undefined })}
                aria-current={active ? "page" : undefined}
                className={`${styles.tabLink} ${active ? styles.tabLinkActive : ""}`}
              >
                {candidate.label}
                <span className={`price ${styles.tabCount} ${active ? styles.tabCountActive : ""}`}>{count}</span>
              </Link>
            );
          })}
        </nav>
        <form className={styles.searchForm} role="search">
          <input type="hidden" name="view" value={view.key} />
          <Search size={16} className={styles.searchIcon} />
          <input
            name="q"
            defaultValue={search}
            placeholder="Order #, name, phone or email"
            aria-label="Search orders"
            className={styles.searchInput}
          />
        </form>
      </div>

      {view.key === "whatsapp" && (
        <div className={styles.mb4}>
          <Notice
            tone="warning"
            title="Unverified until you see the message"
            action={<DiscardStaleButton count={staleCount} />}
          >
            These shoppers were shown their order as a WhatsApp message. Opening WhatsApp doesn&apos;t prove they sent
            it. When the message arrives in your chats (it starts with the order number), open the order and mark it as
            received.
          </Notice>
        </div>
      )}

      <Panel padded={false}>
        {list.orders.length === 0 ? (
          <EmptyState icon={<ReceiptText size={20} />} title={search ? "No orders match that search" : "Nothing here right now"}>
            {search ? "Try the order number on its own, or part of the customer's name." : "Orders in this state will appear here."}
          </EmptyState>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.ordersTable}>
              <thead className={styles.tableHead}>
                <tr>
                  <th scope="col" className={styles.thFirst}>Order</th>
                  <th scope="col" className={styles.thStart}>Customer</th>
                  <th scope="col" className={styles.thStart}>Status</th>
                  <th scope="col" className={styles.thStart}>Payment</th>
                  <th scope="col" className={styles.thLast}>Total</th>
                </tr>
              </thead>
              <tbody className={styles.dividerTable}>
                {list.orders.map((order) => (
                  <tr key={order.id} className={styles.orderRow}>
                    <td className={styles.tdFirst}>
                      <Link href={`/admin/orders/${order.id}`} className={`mono ${styles.orderRowLink}`}>
                        #{order.number}
                      </Link>
                      <p className={styles.cellSub}>{formatRelative(order.createdAt, now.getTime())}</p>
                    </td>
                    <td className={styles.tdMid}>
                      <p className={styles.strongText}>{order.customer.name}</p>
                      <div className={styles.cellMetaRow}>
                        <ChannelBadge channel={order.channel} />
                        {order.customer.phone && <span dir="ltr">{order.customer.phone}</span>}
                      </div>
                    </td>
                    <td className={styles.tdMid}>
                      <OrderStatusPill status={order.status} />
                      {isStaleHandoff(order, now) && <p className={styles.staleHint}>Over a week old</p>}
                    </td>
                    <td className={styles.tdMid}>
                      <PaymentPill order={order} />
                    </td>
                    <td className={`mono ${styles.tdLast}`}>{formatMoney(order.total, money, "full")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {pages > 1 && (
        <nav className={styles.pagination} aria-label="Pagination">
          <span className={styles.paginationMeta}>
            Page {page} of {pages} · {list.total} orders
          </span>
          <div className={styles.flexWrapGap2}>
            {page > 1 && (
              <Link href={href({ page: page - 1 })} className={styles.pageLink}>
                Previous
              </Link>
            )}
            {page < pages && (
              <Link href={href({ page: page + 1 })} className={styles.pageLink}>
                Next
              </Link>
            )}
          </div>
        </nav>
      )}
    </>
  );
}
