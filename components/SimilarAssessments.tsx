"use client";

import { useEffect, useState } from "react";
import styles from "./SimilarAssessments.module.css";

interface SimilarAssessment {
  assessmentId: number;
  assessmentName: string;
  platformRecommendation: string;
  confidenceScore: number;
  businessContext: string;
  businessGoal: string;
  businessDriver: string;
  businessRequirement: string;
  similarityScore: number;
}

interface PlatformProfile {
  platform: string;
  displayName: string;
  pros: string[];
  cons: string[];
  bestFitFor: string;
  canadianContext: string;
}

interface LowSignalReport {
  historySuggestion: string | null;
  historyConfidence: number;
  nudgedRecommendation: string;
  nudgedRationale: string;
  overallConfidence: number;
  platformProfiles: PlatformProfile[];
  caveat: string;
}

interface ApiResponse {
  type: "empty" | "low_signal" | "similar";
  similar: SimilarAssessment[];
  lowSignalReport: LowSignalReport | null;
}

interface SimilarAssessmentsProps {
  assessmentId: number;
}

export default function SimilarAssessments({ assessmentId }: SimilarAssessmentsProps) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/assessment/${assessmentId}/similar`);
        if (res.ok) setData(await res.json());
      } catch {
        // informational panel — silently ignore errors
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [assessmentId]);

  if (loading) {
    return (
      <div className={styles.panel}>
        <p className={styles.loadingText}>Retrieving historical precedents (non-decisional)…</p>
      </div>
    );
  }

  // ─── Empty (no responses yet) ───────────────────────────────────────────────
  if (!data || data.type === "empty") {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>
          <h3 className={styles.title}>Historical Precedent Retrieval</h3>
        </div>
        <p className={styles.emptyText}>Add responses to retrieve nearest historical precedents for context.</p>
      </div>
    );
  }

  // ─── Low-signal: show pros/cons + nudged recommendation ────────────────────
  if (data.type === "low_signal" && data.lowSignalReport) {
    const report = data.lowSignalReport;
    return (
      <div className={styles.panel}>
        <div className={styles.header}>
          <h3 className={styles.title}>Historical Precedent Retrieval</h3>
          <button onClick={() => setExpanded((e) => !e)} className={styles.toggleButton}>
            {expanded ? "▲" : "▼"}
          </button>
        </div>

        {expanded && (
          <>
            {/* Caveat banner */}
            <div className={styles.caveatBanner}>
              <span className={styles.caveatIcon}>⚠️</span>
              <span>{report.caveat}</span>
            </div>

            {/* Nudged recommendation */}
            <div className={styles.nudgeCard}>
              <div className={styles.nudgeHeader}>
                <span className={styles.nudgeLabel}>Low-evidence advisory view (non-decisional)</span>
                <span className={styles.lowConfBadge}>Confidence: {report.overallConfidence}% (Low)</span>
              </div>
              <p className={styles.nudgePlatform}>{report.nudgedRecommendation}</p>
              <p className={styles.nudgeRationale}>{report.nudgedRationale}</p>
            </div>

            {data.similar.length > 0 && (
              <div className={styles.semanticContextSection}>
                <h4 className={styles.profilesHeading}>Semantic Comparisons Available as Context Only</h4>
                <p className={styles.semanticContextText}>
                  These are not used to make the recommendation, but they show what similar assessments said using semantic comparison.
                </p>
                <div className={styles.list}>
                  {data.similar.map((item) => (
                    <div key={item.assessmentId} className={styles.card}>
                      <div className={styles.cardHeader}>
                        <span className={styles.cardName}>{item.assessmentName}</span>
                        <span
                          className={`${styles.similarityBadge} ${
                            item.similarityScore >= 80 ? styles.high
                            : item.similarityScore >= 50 ? styles.medium
                            : styles.low
                          }`}
                        >
                          {item.similarityScore}% semantic match
                        </span>
                      </div>

                      <div className={styles.cardMeta}>
                        <span className={styles.metaLabel}>Recommendation:</span>
                        <span className={styles.metaValue}>{item.platformRecommendation}</span>
                        <span className={styles.metaLabel}>Confidence:</span>
                        <span className={styles.metaValue}>{item.confidenceScore}%</span>
                      </div>

                      {item.businessRequirement && (
                        <p className={styles.excerpt}>
                          <span className={styles.excerptLabel}>Requirement: </span>
                          {item.businessRequirement.slice(0, 200)}
                          {item.businessRequirement.length > 200 ? "…" : ""}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Platform pros/cons */}
            <div className={styles.profilesSection}>
              <h4 className={styles.profilesHeading}>Platform Comparison — Canadian Public Sector Context</h4>
              {report.platformProfiles.map((p) => (
                <div key={p.platform} className={`${styles.profileCard} ${p.platform === report.nudgedRecommendation ? styles.profileHighlighted : ""}`}>
                  <button
                    className={styles.profileToggle}
                    onClick={() => setExpandedPlatform(expandedPlatform === p.platform ? null : p.platform)}
                  >
                    <span className={styles.profileName}>{p.displayName}</span>
                    {p.platform === report.nudgedRecommendation && (
                      <span className={styles.nudgePill}>Suggested</span>
                    )}
                    <span className={styles.profileChevron}>
                      {expandedPlatform === p.platform ? "▲" : "▼"}
                    </span>
                  </button>

                  {expandedPlatform === p.platform && (
                    <div className={styles.profileBody}>
                      <div className={styles.prosConsRow}>
                        <div className={styles.prosList}>
                          <h5 className={styles.prosHeading}>Strengths</h5>
                          <ul>
                            {p.pros.map((pro, i) => <li key={i}>{pro}</li>)}
                          </ul>
                        </div>
                        <div className={styles.consList}>
                          <h5 className={styles.consHeading}>Considerations</h5>
                          <ul>
                            {p.cons.map((con, i) => <li key={i}>{con}</li>)}
                          </ul>
                        </div>
                      </div>
                      <div className={styles.profileMeta}>
                        <div><span className={styles.metaLabel}>Best fit for: </span>{p.bestFitFor}</div>
                        <div><span className={styles.metaLabel}>Canadian context: </span>{p.canadianContext}</div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // ─── Normal: show similar historical assessments ──────────────────────────────
  if (data.similar.length === 0) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>
          <h3 className={styles.title}>Historical Precedent Retrieval</h3>
        </div>
        <p className={styles.emptyText}>No close historical precedents were retrieved.</p>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3 className={styles.title}>Similar Historical Assessments</h3>
        <button onClick={() => setExpanded((e) => !e)} className={styles.toggleButton}>
          {expanded ? "▲" : "▼"}
        </button>
      </div>

      {expanded && (
        <div className={styles.list}>
          {data.similar.map((item) => (
            <div key={item.assessmentId} className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardName}>{item.assessmentName}</span>
                <span
                  className={`${styles.similarityBadge} ${
                    item.similarityScore >= 80 ? styles.high
                    : item.similarityScore >= 50 ? styles.medium
                    : styles.low
                  }`}
                >
                  {item.similarityScore}% match
                </span>
              </div>

              <div className={styles.cardMeta}>
                <span className={styles.metaLabel}>Recommendation:</span>
                <span className={styles.metaValue}>{item.platformRecommendation}</span>
                <span className={styles.metaLabel}>Confidence:</span>
                <span className={styles.metaValue}>{item.confidenceScore}%</span>
              </div>

              {item.businessRequirement && (
                <p className={styles.excerpt}>
                  <span className={styles.excerptLabel}>Requirement: </span>
                  {item.businessRequirement.slice(0, 200)}
                  {item.businessRequirement.length > 200 ? "…" : ""}
                </p>
              )}

              {item.businessContext && (
                <p className={styles.excerpt}>
                  <span className={styles.excerptLabel}>Context: </span>
                  {item.businessContext.slice(0, 200)}
                  {item.businessContext.length > 200 ? "…" : ""}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
