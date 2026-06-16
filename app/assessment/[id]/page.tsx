"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import BusinessContextPanel from "@/components/BusinessContextPanel";
import RecommendationReport from "@/components/RecommendationReport";
import { Assessment } from "@/types/assessment";
import styles from "./page.module.css";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

interface Question {
  id: number;
  question_key: string;
  question_text: string;
  factor: string;
  help_text: string | null;
  input_type: string;
  sequence: number;
}

interface StepInfo {
  id: number;
  key: string;
  name: string;
  sequence: number;
}

const STEP_ORDER = [
  "ARCHITECTURE",
  "CLOUD_ASSESSMENT",
  "PLATFORM_ASSESSMENT",
  "OPERATIONAL_CONSIDERATIONS",
  "FINAL_RECOMMENDATION",
];

const STEP_LABELS: Record<string, string> = {
  ARCHITECTURE: "Architecture",
  CLOUD_ASSESSMENT: "Cloud",
  PLATFORM_ASSESSMENT: "Platform",
  OPERATIONAL_CONSIDERATIONS: "Operations",
  FINAL_RECOMMENDATION: "Recommendation",
};

export default function AssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const assessmentId = parseInt(id);

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [allSteps, setAllSteps] = useState<StepInfo[]>([]);
  const [existingRecommendation, setExistingRecommendation] = useState<any>(null);
  const [stepHasData, setStepHasData] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contextSaving, setContextSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [assessmentId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [assessmentRes, stepsRes, responsesRes] = await Promise.all([
        fetch(`${BASE_PATH}/api/assessment/${assessmentId}`),
        fetch(`${BASE_PATH}/api/steps`),
        fetch(`${BASE_PATH}/api/responses?assessmentId=${assessmentId}`),
      ]);

      const assessmentData = await assessmentRes.json();
      const stepsData = await stepsRes.json();
      const responsesData = await responsesRes.json();

      setAssessment(assessmentData);
      setAllSteps(stepsData);
      setResponses(responsesData);

      const answeredQuestionKeys = new Set(
        Object.entries(responsesData)
          .filter(([, value]) => typeof value === "string" && value.trim().length > 0)
          .map(([questionKey]) => questionKey)
      );

      const stepDataEntries = await Promise.all(
        STEP_ORDER.map(async (stepKey) => {
          if (stepKey === "FINAL_RECOMMENDATION") {
            const hasRecommendationData =
              assessmentData.status === "completed" ||
              assessmentData.current_step_id === "FINAL_RECOMMENDATION";
            return [stepKey, hasRecommendationData] as const;
          }

          const res = await fetch(`${BASE_PATH}/api/questions?step=${stepKey}`);
          const stepQuestions = (await res.json()) as Array<{ question_key: string }>;
          const hasData = stepQuestions.some((q) => answeredQuestionKeys.has(q.question_key));
          return [stepKey, hasData] as const;
        })
      );
      setStepHasData(Object.fromEntries(stepDataEntries));

      // Load questions for current step (default to ARCHITECTURE if null)
      const stepForQuestions = assessmentData.current_step_id ?? STEP_ORDER[0];
      const questionsRes = await fetch(`${BASE_PATH}/api/questions?step=${stepForQuestions}`);
      const questionsData = await questionsRes.json();
      setQuestions(questionsData);

      // Try to load existing recommendation (if at final step)
      if (assessmentData.current_step_id === "FINAL_RECOMMENDATION" || assessmentData.status === "completed") {
        const recRes = await fetch(`${BASE_PATH}/api/assessment/${assessmentId}/recommend`);
        if (recRes.ok) {
          const recData = await recRes.json();
          setExistingRecommendation(recData);
        }
      }
    } catch (err) {
      console.error("Failed to load assessment:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleResponseChange = (questionKey: string, value: string) => {
    setResponses((prev) => ({ ...prev, [questionKey]: value }));
  };

  const saveResponse = async (questionKey: string) => {
    const value = responses[questionKey];
    if (value === undefined) return;
    setSaving(true);
    try {
      await fetch(`${BASE_PATH}/api/response/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId, questionKey, value }),
      });
    } catch (err) {
      console.error("Failed to save response:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleContextUpdate = async (updates: Partial<Assessment>) => {
    setContextSaving(true);
    try {
      const res = await fetch(`${BASE_PATH}/api/assessment/${assessmentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const updated = await res.json();
        setAssessment(updated);
      }
    } catch (err) {
      console.error("Failed to update context:", err);
    } finally {
      setContextSaving(false);
    }
  };

  const handleNext = async () => {
    // Save any pending responses first
    const res = await fetch(`${BASE_PATH}/api/assessment/${assessmentId}/next`, { method: "POST" });
    if (res.ok) {
      await loadData();
    }
  };

  const handlePrevious = async () => {
    const res = await fetch(`${BASE_PATH}/api/assessment/${assessmentId}/previous`, { method: "POST" });
    if (res.ok) {
      await loadData();
    }
  };

  const handleStepJump = async (targetStep: string) => {
    if (saving || contextSaving || targetStep === currentStep) return;
    if (!stepHasData[targetStep] && targetStep !== currentStep) return;
    try {
      const res = await fetch(`${BASE_PATH}/api/assessment/${assessmentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_step_id: targetStep }),
      });
      if (res.ok) {
        await loadData();
      }
    } catch (err) {
      console.error("Failed to change step:", err);
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <p>Loading assessment...</p>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className={styles.errorScreen}>
        <h2>Assessment not found</h2>
        <Link href="/">← Back to assessments</Link>
      </div>
    );
  }

  const currentStep = assessment.current_step_id ?? STEP_ORDER[0];
  const currentStepIndex = STEP_ORDER.indexOf(currentStep);
  const isLastStep = currentStep === "FINAL_RECOMMENDATION";
  const hasPrevious = currentStepIndex > 0;
  const hasNext = !isLastStep;

  return (
    <div className={styles.page}>
      {/* Top nav */}
      <div className={styles.topNav}>
        <Link href="/" className={styles.backLink}>← All Assessments</Link>
        <div className={styles.assessmentMeta}>
          <h1 className={styles.title}>{assessment.name}</h1>
          <span className={`${styles.statusBadge} ${styles[assessment.status]}`}>
            {assessment.status}
          </span>
        </div>
        {saving && <span className={styles.savingIndicator}>Saving…</span>}
      </div>

      {/* Step progress bar */}
      <div className={styles.progressBar}>
        {STEP_ORDER.map((stepKey, idx) => {
          const isCompleted = idx < currentStepIndex;
          const isCurrent = idx === currentStepIndex;
          return (
            <div
              key={stepKey}
              className={`${styles.stepItem} ${isCompleted ? styles.stepDone : ""} ${isCurrent ? styles.stepActive : ""}`}
            >
              <button
                type="button"
                className={styles.stepButton}
                onClick={() => handleStepJump(stepKey)}
                disabled={isCurrent || saving || contextSaving || !stepHasData[stepKey]}
                title={isCurrent ? "Current step" : `Go to ${STEP_LABELS[stepKey]}`}
              >
                <div className={styles.stepBubble}>{idx + 1}</div>
                <span className={styles.stepLabel}>{STEP_LABELS[stepKey]}</span>
              </button>
              {idx < STEP_ORDER.length - 1 && <div className={`${styles.stepConnector} ${isCompleted ? styles.connectorDone : ""}`} />}
            </div>
          );
        })}
      </div>

      <div className={styles.content}>
        {/* Business context is shown during steps 1-4 only */}
        {!isLastStep && (
          <BusinessContextPanel
            assessment={assessment}
            onUpdate={handleContextUpdate}
            isSaving={contextSaving}
          />
        )}

        {/* Current step questions */}
        <div className={styles.questionsSection}>
          <h2 className={styles.stepHeading}>
            {STEP_LABELS[currentStep]} — Step {currentStepIndex + 1} of {STEP_ORDER.length}
          </h2>

          {isLastStep ? (
            // Final step shows the recommendation engine
            <RecommendationReport
              assessmentId={assessmentId}
              existingRecommendation={existingRecommendation}
            />
          ) : (
            // All other steps show questions
            <div className={styles.questionsList}>
                {questions.length === 0 ? (
                  <p className={styles.noQuestions}>No questions found for this step.</p>
                ) : (
                  questions.map((q) => (
                    <div key={q.id} className={styles.questionCard}>
                      <label className={styles.questionLabel}>
                        <span className={styles.questionKey}>{q.question_key}</span>
                        {q.question_text}
                      </label>
                      {q.help_text && (
                        <p className={styles.helpText}>{q.help_text}</p>
                      )}
                      <textarea
                        className={styles.responseInput}
                        value={responses[q.question_key] || ""}
                        onChange={(e) => handleResponseChange(q.question_key, e.target.value)}
                        onBlur={() => saveResponse(q.question_key)}
                        rows={4}
                        placeholder="Enter your response here…"
                      />
                    </div>
                  ))
                )}
              </div>
          )}
        </div>

        {/* Step navigation */}
        <div className={styles.navigation}>
          <button
            onClick={handlePrevious}
            disabled={!hasPrevious}
            className={styles.navButton}
          >
            ← Previous Step
          </button>

          <div className={styles.navCenter}>
            Step {currentStepIndex + 1} of {STEP_ORDER.length}
          </div>

          {hasNext && (
            <button
              onClick={handleNext}
              className={`${styles.navButton} ${styles.navNext}`}
            >
              Next Step →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

