"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

type CheckStatus = "pass" | "warn" | "fail";

interface HealthCheck {
  id: string;
  label: string;
  status: CheckStatus;
  summary: string;
  details?: string;
  fix: string[];
}

interface HealthPayload {
  overall: CheckStatus;
  generatedAt: string;
  checks: HealthCheck[];
  readmeQuickFixes: string[];
}

const statusLabel: Record<CheckStatus, string> = {
  pass: "Healthy",
  warn: "Needs Attention",
  fail: "Action Required",
};

export default function HealthPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<HealthPayload | null>(null);

  const loadHealth = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${BASE_PATH}/api/health`, { cache: "no-store" });
      const json = (await res.json()) as HealthPayload;
      setPayload(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await loadHealth();
    })();
  }, []);

  const totals = useMemo(() => {
    const base = { pass: 0, warn: 0, fail: 0 };
    for (const c of payload?.checks ?? []) base[c.status] += 1;
    return base;
  }, [payload]);

  const generatedAt = payload?.generatedAt ? new Date(payload.generatedAt).toLocaleString() : "-";

  return (
    <main className={styles.page}>
      <div className={styles.bgGlowOne} />
      <div className={styles.bgGlowTwo} />

      <section className={styles.heroCard}>
        <p className={styles.kicker}>EAAF System Diagnostics</p>
        <h1 className={styles.title}>Application Health Dashboard</h1>
        <p className={styles.subtitle}>
          Live checks for app rendering, database setup, seed data availability, and local embedding service readiness.
        </p>

        <div className={styles.heroActions}>
          <button className={styles.refreshButton} onClick={loadHealth} disabled={loading}>
            {loading ? "Running checks..." : "Run Checks Again"}
          </button>
          <span className={styles.timestamp}>Last check: {generatedAt}</span>
        </div>

        {payload && (
          <div className={styles.summaryGrid}>
            <div className={`${styles.metricCard} ${styles.passCard}`}>
              <span>Healthy</span>
              <strong>{totals.pass}</strong>
            </div>
            <div className={`${styles.metricCard} ${styles.warnCard}`}>
              <span>Warnings</span>
              <strong>{totals.warn}</strong>
            </div>
            <div className={`${styles.metricCard} ${styles.failCard}`}>
              <span>Failures</span>
              <strong>{totals.fail}</strong>
            </div>
            <div className={`${styles.metricCard} ${styles.overallCard} ${styles[`overall_${payload.overall}`]}`}>
              <span>Overall</span>
              <strong>{statusLabel[payload.overall]}</strong>
            </div>
          </div>
        )}
      </section>

      {error && (
        <section className={styles.errorCard}>
          <h2>Unable to run checks</h2>
          <p>{error}</p>
          <p>Verify app server is running with <code>npm run dev</code>.</p>
        </section>
      )}

      {!error && payload && (
        <section className={styles.resultsGrid}>
          {payload.checks.map((check) => (
            <article key={check.id} className={`${styles.checkCard} ${styles[`card_${check.status}`]}`}>
              <header className={styles.checkHeader}>
                <h3>{check.label}</h3>
                <span className={`${styles.badge} ${styles[`badge_${check.status}`]}`}>{statusLabel[check.status]}</span>
              </header>

              <p className={styles.summary}>{check.summary}</p>
              {check.details && <p className={styles.details}>{check.details}</p>}

              {check.fix.length > 0 && (
                <div className={styles.fixBlock}>
                  <p>Fix from README:</p>
                  <ul>
                    {check.fix.map((line) => (
                      <li key={line}>
                        <code>{line}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          ))}
        </section>
      )}

      {!error && payload && payload.readmeQuickFixes.length > 0 && (
        <section className={styles.quickFixPanel}>
          <h2>One-shot Recovery Flow</h2>
          <p>If everything is broken, run these in order:</p>
          <ol>
            {payload.readmeQuickFixes.map((step) => (
              <li key={step}><code>{step}</code></li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}
