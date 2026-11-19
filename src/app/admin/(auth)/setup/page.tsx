import type { Metadata } from "next";
import { redirect } from "next/navigation";
import styles from "@/components/admin/admin.module.css";
import { OwnerSetupForm } from "@/components/admin/AuthForms";
import { Notice } from "@/components/admin/ui";
import { getBackend } from "@/server/backend";

export const metadata: Metadata = { title: "Set up your store" };

/**
 * First run of a local store: create the owner account. Available only while
 * no owner exists; in production it also requires ADMIN_SETUP_TOKEN, so
 * nobody who finds the address first can claim the store.
 */
export default async function SetupPage() {
  const state = await getBackend().auth.setupState();
  if (state.kind !== "needs-owner") redirect("/admin/login");

  return (
    <div className={styles.authCard}>
      <p className="eyebrow">Welcome</p>
      <h1 className={`display ${styles.authTitle}`}>Create the owner account</h1>
      <p className={styles.authBodyCopy}>
        This is the login you&apos;ll use to manage products, orders and settings. It can only be created once.
      </p>
      <div className={styles.authSection}>
        {state.setupAllowed ? (
          <OwnerSetupForm tokenRequired={state.tokenRequired} />
        ) : (
          <Notice tone="warning" title="Setup is locked">
            This store is running in production without an owner. Add an <code className={styles.inlineCode}>ADMIN_SETUP_TOKEN</code>{" "}
            environment variable (any long random value) in your host settings, restart or redeploy the app, then enter
            that token here.
          </Notice>
        )}
      </div>
    </div>
  );
}
