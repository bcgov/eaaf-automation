"use client";

import { useState } from "react";
import styles from "./JurisdictionScan.module.css";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// ── Types ─────────────────────────────────────────────────────────────────

interface JurisdictionEntry {
  jurisdiction: string;
  organization: string;
  sector: "public" | "private";
  solution: string;
  platform: string | null;
  alignmentScore: number;
  alignmentRationale: string;
  businessProblemAlignment: string;
  driverAlignment: string;
  requirementAlignment: string;
  currentStateComparison: string;
  proposedSolutionComparison: string;
  referenceUrl: string | null;
}

interface JurisdictionScanResult {
  canada: JurisdictionEntry[];
  us: JurisdictionEntry[];
  europe: JurisdictionEntry[];
  other: JurisdictionEntry[];
  publicSectorAvailable: boolean;
  generatedAt: string;
  aiProvider: string;
  aiModel: string;
  inputs: {
    assessmentName: string;
    businessProblem: string;
    drivers: string;
    requirements: string;
    currentState: string;
    proposedSolution: string;
  };
}

interface Props {
  assessmentId: number;
}

// ── Region config ─────────────────────────────────────────────────────────

const REGIONS: Array<{
  key: keyof Pick<JurisdictionScanResult, "canada" | "us" | "europe" | "other">;
  label: string;
  flag: string;
}> = [
  { key: "canada", label: "Canada", flag: "🇨🇦" },
  { key: "us", label: "United States", flag: "🇺🇸" },
  { key: "europe", label: "Europe", flag: "🇪🇺" },
  { key: "other", label: "Rest of World", flag: "🌏" },
];

// ── Score badge ───────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const cls =
    score >= 80
      ? styles.scoreHigh
      : score >= 65
      ? styles.scoreMedium
      : styles.scoreLow;
  return <span className={`${styles.scoreBadge} ${cls}`}>{score}%</span>;
}

// ── Expandable detail row ─────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: string }) {
  if (!value?.trim()) return null;
  return (
    <div className={styles.detailRow}>
      <span className={styles.detailLabel}>{label}</span>
      <span className={styles.detailValue}>{value}</span>
    </div>
  );
}

// ── Entry card ────────────────────────────────────────────────────────────

function EntryCard({ entry, rank }: { entry: JurisdictionEntry; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={styles.entryCard}>
      <div className={styles.entryHeader}>
        <div className={styles.entryRank}>#{rank}</div>
        <div className={styles.entryMeta}>
          <div className={styles.entryOrg}>{entry.organization}</div>
          <div className={styles.entryJurisdiction}>
            {entry.jurisdiction}
            <span className={`${styles.sectorPill} ${entry.sector === "public" ? styles.sectorPublic : styles.sectorPrivate}`}>
              {entry.sector}
            </span>
            {entry.platform && (
              <span className={styles.platformPill}>{entry.platform}</span>
            )}
          </div>
        </div>
        <ScoreBadge score={entry.alignmentScore} />
      </div>

      <p className={styles.entrySolution}>{entry.solution}</p>
      <p className={styles.entryRationale}>{entry.alignmentRationale}</p>

      <button
        type="button"
        className={styles.expandBtn}
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? "▲ Hide detail" : "▼ Show alignment detail"}
      </button>

      {expanded && (
        <div className={styles.detailBlock}>
          <DetailRow label="Business Problem" value={entry.businessProblemAlignment} />
          <DetailRow label="Drivers" value={entry.driverAlignment} />
          <DetailRow label="Requirements" value={entry.requirementAlignment} />
          <DetailRow label="Current State" value={entry.currentStateComparison} />
          <DetailRow label="Solution Comparison" value={entry.proposedSolutionComparison} />
          {entry.referenceUrl && (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Reference</span>
              <a
                href={entry.referenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.refLink}
              >
                {entry.referenceUrl}
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Region section ────────────────────────────────────────────────────────

function RegionSection({
  flag,
  label,
  entries,
}: {
  flag: string;
  label: string;
  entries: JurisdictionEntry[];
}) {
  if (entries.length === 0) {
    return (
      <div className={styles.regionBlock}>
        <div className={styles.regionHeader}>
          <span className={styles.regionFlag}>{flag}</span>
          <span className={styles.regionLabel}>{label}</span>
        </div>
        <p className={styles.noResults}>No comparable implementations found for this region.</p>
      </div>
    );
  }

  return (
    <div className={styles.regionBlock}>
      <div className={styles.regionHeader}>
        <span className={styles.regionFlag}>{flag}</span>
        <span className={styles.regionLabel}>{label}</span>
        <span className={styles.regionCount}>{entries.length} match{entries.length !== 1 ? "es" : ""}</span>
      </div>
      <div className={styles.entryList}>
        {entries.map((entry, i) => (
          <EntryCard key={i} entry={entry} rank={i + 1} />
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function JurisdictionScan({ assessmentId }: Props) {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<JurisdictionScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runScan = async () => {
    setScanning(true);
    setError(null);
    try {
      const res = await fetch(
        `${BASE_PATH}/api/assessment/${assessmentId}/jurisdiction-scan`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Scan failed");
      }
      setResult(data as JurisdictionScanResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Jurisdiction scan failed");
    } finally {
      setScanning(false);
    }
  };

  const totalResults =
    result
      ? result.canada.length +
        result.us.length +
        result.europe.length +
        result.other.length
      : 0;

  // ── Prompt state ──────────────────────────────────────────────────────
  if (!result && !scanning) {
    return (
      <div className={styles.promptState}>
        <div className={styles.promptIcon}>🌐</div>
        <h4 className={styles.promptTitle}>Jurisdiction Scan</h4>
        <p className={styles.promptDesc}>
          Queries an AI model to find real-world public sector implementations from Canadian,
          US, European, and global jurisdictions that are most closely aligned with this
          assessment&apos;s business problem, drivers, requirements, current state, and proposed solution.
        </p>
        <button onClick={runScan} className={styles.scanBtn}>
          Run Jurisdiction Scan
        </button>
        {error && <p className={styles.errorMsg}>{error}</p>}
      </div>
    );
  }

  // ── Loading state ─────────────────────────────────────────────────────
  if (scanning) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner} />
        <p className={styles.loadingText}>Scanning jurisdictions — this may take up to 30 seconds…</p>
      </div>
    );
  }

  // ── Results ───────────────────────────────────────────────────────────
  return (
    <div className={styles.results}>
      {/* Meta bar */}
      <div className={styles.metaBar}>
        <span className={styles.metaItem}>
          <strong>{totalResults}</strong> implementations found
        </span>
        {!result!.publicSectorAvailable && (
          <span className={styles.privateNotice}>
            ⚠ Some regions returned private sector results (no public sector cases found)
          </span>
        )}
        <span className={styles.metaItem} style={{ marginLeft: "auto" }}>
          {result!.aiProvider} / {result!.aiModel}
        </span>
        <button onClick={runScan} disabled={scanning} className={styles.rescanBtn}>
          Re-scan
        </button>
      </div>

      {/* Inputs summary */}
      <details className={styles.inputsSummary}>
        <summary className={styles.inputsSummaryToggle}>View scan inputs</summary>
        <div className={styles.inputsGrid}>
          <div className={styles.inputRow}><span className={styles.inputLabel}>Business Problem</span><span>{result!.inputs.businessProblem || "—"}</span></div>
          <div className={styles.inputRow}><span className={styles.inputLabel}>Drivers</span><span>{result!.inputs.drivers || "—"}</span></div>
          <div className={styles.inputRow}><span className={styles.inputLabel}>Requirements</span><span>{result!.inputs.requirements || "—"}</span></div>
          <div className={styles.inputRow}><span className={styles.inputLabel}>Current State</span><span>{result!.inputs.currentState || "—"}</span></div>
          <div className={styles.inputRow}><span className={styles.inputLabel}>Proposed Solution</span><span>{result!.inputs.proposedSolution || "—"}</span></div>
        </div>
      </details>

      {/* Results by region */}
      {REGIONS.map(({ key, label, flag }) => (
        <RegionSection
          key={key}
          flag={flag}
          label={label}
          entries={result![key]}
        />
      ))}

      <p className={styles.disclaimer}>
        Jurisdiction scan results are generated by an AI model based on its training knowledge.
        Results should be independently verified before use in governance submissions.
        Generated {new Date(result!.generatedAt).toLocaleString()}.
      </p>
    </div>
  );
}
