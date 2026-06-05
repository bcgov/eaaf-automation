"use client";

import { useState } from "react";
import styles from "./RecommendationReport.module.css";
import { RecommendationResult, Platform } from "@/lib/recommendation/engine";

interface RecommendationReportProps {
  assessmentId: number;
  existingRecommendation?: {
    platform_recommendation: string;
    rationale: string;
    confidence_score: number;
    risks: string;
    alternatives: string;
    created_at: string;
  } | null;
}

const PLATFORM_ICON: Record<string, string> = {
  Salesforce: "☁",
  ServiceNow: "⚙",
  MicrosoftPowerPlatform: "🪟",
  CustomBuild: "🔧",
};

export default function RecommendationReport({
  assessmentId,
  existingRecommendation,
}: RecommendationReportProps) {
  const [recommendation, setRecommendation] = useState<RecommendationResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/assessment/${assessmentId}/recommend`, {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Failed to generate recommendation");
      }

      const data = await res.json();
      setRecommendation(data);
    } catch (err) {
      setError("Failed to generate recommendation. Please ensure all steps are answered.");
    } finally {
      setIsGenerating(false);
    }
  };

  const getConfidenceClass = (score: number) => {
    if (score >= 75) return styles.confidenceHigh;
    if (score >= 50) return styles.confidenceMedium;
    return styles.confidenceLow;
  };

  const getScoreBarClass = (score: number) => {
    if (score >= 75) return styles.barHigh;
    if (score >= 50) return styles.barMedium;
    return styles.barLow;
  };

  if (!recommendation && existingRecommendation) {
    return (
      <div className={styles.report}>
        <div className={styles.header}>
          <h2>Platform Recommendation</h2>
          <span className={styles.existingBadge}>Previously Generated</span>
        </div>

        <div className={styles.winnerCard}>
          <div className={styles.winnerHeader}>
            <span className={styles.winnerIcon}>☁</span>
            <div>
              <h3 className={styles.winnerName}>{existingRecommendation.platform_recommendation}</h3>
              <div className={`${styles.confidence} ${getConfidenceClass(existingRecommendation.confidence_score)}`}>
                Confidence: {existingRecommendation.confidence_score}%
              </div>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h4>Rationale</h4>
          <p>{existingRecommendation.rationale}</p>
        </div>

        <div className={styles.twoCol}>
          <div className={styles.section}>
            <h4>⚠ Risks</h4>
            <p>{existingRecommendation.risks}</p>
          </div>
          <div className={styles.section}>
            <h4>🔄 Alternatives</h4>
            <p>{existingRecommendation.alternatives}</p>
          </div>
        </div>

        <div className={styles.regenerateBar}>
          <small>Generated: {new Date(existingRecommendation.created_at).toLocaleString()}</small>
          <button onClick={handleGenerate} disabled={isGenerating} className={styles.regenerateButton}>
            {isGenerating ? "Re-generating..." : "Re-generate Recommendation"}
          </button>
        </div>
      </div>
    );
  }

  if (!recommendation) {
    return (
      <div className={styles.generatePrompt}>
        <div className={styles.promptIcon}>🎯</div>
        <h3>Ready for Recommendation</h3>
        <p>
          Click below to run the EAAF scoring engine. It analyses all your responses across
          Architecture, Cloud, Platform and Operational steps to determine the best platform fit.
        </p>
        {error && <p className={styles.error}>{error}</p>}
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className={styles.generateButton}
        >
          {isGenerating ? "Analysing responses..." : "Generate Platform Recommendation"}
        </button>
      </div>
    );
  }

  const { platformScores } = recommendation;

  return (
    <div className={styles.report}>
      <div className={styles.header}>
        <h2>Platform Recommendation</h2>
        <span className={styles.newBadge}>Just Generated</span>
      </div>

      {/* Winner card */}
      <div className={styles.winnerCard}>
        <div className={styles.winnerHeader}>
          <span className={styles.winnerIcon}>
            {PLATFORM_ICON[recommendation.platform] ?? "☁"}
          </span>
          <div>
            <h3 className={styles.winnerName}>{recommendation.displayName}</h3>
            <div className={`${styles.confidence} ${getConfidenceClass(recommendation.confidenceScore)}`}>
              Confidence Score: {recommendation.confidenceScore}%
            </div>
          </div>
        </div>

        {/* Confidence bar */}
        <div className={styles.progressTrack}>
          <div
            className={`${styles.progressBar} ${getScoreBarClass(recommendation.confidenceScore)}`}
            style={{ width: `${recommendation.confidenceScore}%` }}
          />
        </div>
      </div>

      {/* Platform comparison */}
      <div className={styles.section}>
        <h4>Platform Comparison</h4>
        <div className={styles.platformList}>
          {platformScores.map((ps, i) => (
            <div key={ps.platform} className={`${styles.platformRow} ${i === 0 ? styles.platformWinner : ""}`}>
              <div className={styles.platformName}>
                <span>{PLATFORM_ICON[ps.platform] ?? "•"}</span>
                <span>{ps.platform}</span>
                {i === 0 && <span className={styles.winnerTag}>RECOMMENDED</span>}
              </div>
              <div className={styles.platformScore}>
                <div className={styles.miniTrack}>
                  <div
                    className={`${styles.miniBar} ${getScoreBarClass(ps.score)}`}
                    style={{ width: `${ps.score}%` }}
                  />
                </div>
                <span className={styles.scoreLabel}>{ps.score}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rationale */}
      <div className={styles.section}>
        <h4>Rationale</h4>
        <p className={styles.rationale}>{recommendation.rationale}</p>
      </div>

      {/* Risks & Alternatives side by side */}
      <div className={styles.twoCol}>
        <div className={styles.section}>
          <h4>⚠ Risks</h4>
          <p>{recommendation.risks}</p>
        </div>
        <div className={styles.section}>
          <h4>🔄 Alternatives</h4>
          <p>{recommendation.alternatives}</p>
        </div>
      </div>

      <div className={styles.regenerateBar}>
        <button onClick={handleGenerate} disabled={isGenerating} className={styles.regenerateButton}>
          {isGenerating ? "Re-generating..." : "Re-generate"}
        </button>
      </div>
    </div>
  );
}
