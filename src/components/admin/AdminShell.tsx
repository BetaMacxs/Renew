"use client";

import {
  Brush,
  Eye,
  ExternalLink,
  FolderTree,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ReceiptText,
  Settings,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { endPreviewAction, signOutAction } from "@/server/actions/admin";
import styles from "./admin.module.css";
import { PreviewProvider } from "./preview";

type Props = {
  storeName: string;
  userEmail: string;
  backendKind: "local" | "supabase";
  ordersNeedingAttention: number;
  /** The public demo's read-only dashboard preview. */
  preview?: boolean;
  children: ReactNode;
};

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/orders", label: "Orders", icon: ReceiptText },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/collections", label: "Collections", icon: Layers },
  { href: "/admin/storefront", label: "Storefront", icon: Brush },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell({ storeName, userEmail, backendKind, ordersNeedingAttention, preview = false, children }: Props) {
  const pathname = usePathname();
  // The menu belongs to the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (value: boolean) => setOpenOn(value ? pathname : null);

  const nav = (
    <nav className={styles.sidebarNav} aria-label="Dashboard">
      {NAV.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
          >
            <Icon size={18} strokeWidth={1.8} />
            <span className={styles.navLabel}>{label}</span>
            {href === "/admin/orders" && ordersNeedingAttention > 0 && (
              <span
                className={`price ${styles.navBadge} ${active ? styles.navBadgeActive : ""}`}
                aria-label={`${ordersNeedingAttention} need attention`}
              >
                {ordersNeedingAttention}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const sidebar = (
    <div className={styles.sidebarInner}>
      <div className={styles.sidebarHeader}>
        <p className={`display ${styles.sidebarBrand}`}>{storeName}</p>
        <Link href="/" target="_blank" className={styles.viewStoreLink}>
          View store <ExternalLink size={12} />
        </Link>
      </div>
      {nav}
      <div className={styles.sidebarFooter}>
        {backendKind === "local" && !preview && (
          <p className={styles.localWarning}>
            <span className={styles.strongText}>Local mode.</span> Data is stored in the hosted environment&apos;s{" "}
            <code className={styles.inlineCode}>.data</code> folder. Connect Supabase before going live.
          </p>
        )}
        <p className={styles.userEmail} title={userEmail}>
          {userEmail}
        </p>
        <form action={preview ? endPreviewAction : signOutAction}>
          <button type="submit" className={styles.signOutBtn}>
            <LogOut size={16} /> {preview ? "Leave preview" : "Sign out"}
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebarDesktop}>{sidebar}</aside>

      <header className={styles.mobileTopBar}>
        <button type="button" onClick={() => setOpen(true)} className={styles.mobileIconBtn} aria-label="Open menu">
          <Menu size={20} />
        </button>
        <p className={`display ${styles.mobileBrand}`}>{storeName}</p>
        <Link href="/" target="_blank" className={styles.mobileIconBtn} aria-label="View store">
          <ExternalLink size={18} />
        </Link>
      </header>

      {open && (
        <div className={styles.mobileDrawerRoot} role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className={styles.mobileBackdrop} onClick={() => setOpen(false)} aria-label="Close menu" />
          <div className={styles.mobileDrawerPanel}>
            <button type="button" onClick={() => setOpen(false)} className={styles.mobileDrawerClose} aria-label="Close menu">
              <X size={18} />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      <main className={styles.main}>
        <div className={styles.mainInner}>
          {preview && (
            <div className={styles.previewBanner} data-testid="preview-banner">
              <Eye size={18} className={styles.previewBannerIcon} />
              <p>
                <span className={styles.strongText}>You&apos;re exploring a read-only preview of the dashboard.</span> Look
                around and try the controls — nothing you change is saved. The orders are samples made up for the preview.
              </p>
            </div>
          )}
          <PreviewProvider preview={preview}>{children}</PreviewProvider>
        </div>
      </main>
    </div>
  );
}
