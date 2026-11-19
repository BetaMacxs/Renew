import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Eye } from "lucide-react";
import styles from "@/components/admin/admin.module.css";
import { SignInForm } from "@/components/admin/AuthForms";
import { Notice } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";
import { startPreviewAction } from "@/server/actions/admin";
import { currentAdmin } from "@/server/admin";
import { getBackend } from "@/server/backend";
import type { SetupState } from "@/server/backend/types";
import { backendKind, publicDemoMode } from "@/server/env";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  let state: SetupState;
  try {
    state = await getBackend().auth.setupState();
  } catch (error) {
    state = { kind: "misconfigured", reason: error instanceof Error ? error.message : "The store's database is not reachable." };
  }
  // A public demo never sends visitors to the owner-setup screen.
  if (state.kind === "needs-owner" && !publicDemoMode()) redirect("/admin/setup");
  if (state.kind === "ready" && (await currentAdmin())) redirect("/admin");

  let storeName = "Your store";
  try {
    storeName = (await getBackend().public.loadSettings()).store.name;
  } catch {
    // Shown with the misconfiguration notice below.
  }

  return (
    <div className={styles.authCard}>
      <p className="eyebrow">Dashboard</p>
      <h1 className={`display ${styles.authTitle}`}>{storeName}</h1>

      {state.kind === "misconfigured" ? (
        <div className={styles.authStack}>
          <Notice tone="warning" title="The store isn't connected to its database yet">
            {state.reason}
          </Notice>
          <p className={styles.authHint}>
            Connect your Supabase database by running the SQL migrations in <code className={styles.inlineCode}>supabase/migrations/</code>{" "}
            and adding the required server environment variables (<code className={styles.inlineCode}>SUPABASE_URL</code>,{" "}
            <code className={styles.inlineCode}>SUPABASE_PUBLISHABLE_KEY</code>, and{" "}
            <code className={styles.inlineCode}>SUPABASE_SECRET_KEY</code>) in your host environment settings,
            then redeploy or restart the app.
          </p>
        </div>
      ) : (
        <div className={styles.authSection}>
          {publicDemoMode() && (
            <div className={styles.previewEntryCard} data-testid="preview-entry">
              <p className={styles.previewEntryTitle}>Exploring the demo?</p>
              <p className={styles.previewEntryText}>
                Open the dashboard as a guest. You can look at everything — products, orders, settings — and nothing you
                change is saved.
              </p>
              <form action={startPreviewAction} className={styles.previewEntryForm}>
                <button type="submit" className={buttonClass({ full: true })}>
                  <Eye size={17} /> Explore the dashboard
                </button>
              </form>
              <p className={styles.previewEntryDivider}>Store owner? Sign in below</p>
            </div>
          )}
          <SignInForm autoFocus={!publicDemoMode()} />
          {backendKind() === "supabase" && !publicDemoMode() && (
            <details className={styles.authDetails}>
              <summary className={styles.authSummary}>First time? Create your admin login</summary>
              <ol className={styles.authOrderedList}>
                <li>
                  In Supabase, open <strong>Authentication → Users → Add user</strong>, enter your email and a password,
                  and tick <em>Auto confirm user</em>.
                </li>
                <li>
                  Open the <strong>SQL editor</strong> in Supabase and run:{" "}
                  <code className={styles.codeBlock}>select public.grant_admin(&apos;you@example.com&apos;);</code>
                </li>
                <li>Come back here and sign in.</li>
              </ol>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
