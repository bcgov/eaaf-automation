"use client";

import React, { useState } from "react";
import Link from "next/link";
import AssessmentForm from "@/components/AssessmentForm";
import { CreateAssessmentRequest, Assessment } from "@/types/assessment";
import styles from "./page.module.css";

export default function HomePage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load assessments on mount
  React.useEffect(() => {
    loadAssessments();
  }, []);

  const loadAssessments = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/assessments");
      const data = await res.json();
      setAssessments(data);
    } catch (err) {
      console.error("Failed to load assessments:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAssessment = async (formData: CreateAssessmentRequest) => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/assessment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        throw new Error("Failed to create assessment");
      }

      const data = await res.json();
      // Redirect to the new assessment
      window.location.href = `/assessment/${data.id}`;
    } catch (err) {
      console.error("Failed to create assessment:", err);
      setIsSubmitting(false);
    }
  };

  if (showCreateForm) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>Create New Assessment</h1>
          <button
            className={styles.backButton}
            onClick={() => setShowCreateForm(false)}
          >
            ← Back to Assessments
          </button>
        </div>
        <AssessmentForm
          onSubmit={handleCreateAssessment}
          isLoading={isSubmitting}
          mode="create"
        />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Enterprise Architecture Assessment Framework</h1>
        <p className={styles.subtitle}>
          EAAF: Structured assessment for architecture decisions across 5 steps
        </p>
      </div>

      <div className={styles.actions}>
        <button
          className={styles.createButton}
          onClick={() => setShowCreateForm(true)}
        >
          + Create New Assessment
        </button>
      </div>

      <div className={styles.content}>
        {loading ? (
          <p className={styles.loading}>Loading assessments...</p>
        ) : assessments.length === 0 ? (
          <div className={styles.emptyState}>
            <h2>No Assessments Yet</h2>
            <p>Create your first assessment to get started with the EAAF framework.</p>
            <p>You'll capture business context, goals, and drivers, then work through:</p>
            <ul>
              <li><strong>Architecture</strong> – Enterprise standards alignment</li>
              <li><strong>Cloud Assessment</strong> – SaaS vs custom build</li>
              <li><strong>Platform Assessment</strong> – Platform fit evaluation</li>
              <li><strong>Operational Considerations</strong> – Support & compliance</li>
              <li><strong>Final Recommendation</strong> – Platform recommendation</li>
            </ul>
          </div>
        ) : (
          <div className={styles.assessmentsList}>
            <h2>Your Assessments ({assessments.length})</h2>
            <div className={styles.grid}>
              {assessments.map((assessment) => (
                <Link
                  key={assessment.id}
                  href={`/assessment/${assessment.id}`}
                  className={styles.assessmentCard}
                >
                  <div className={styles.cardHeader}>
                    <h3>{assessment.name}</h3>
                    <span className={`${styles.badge} ${styles[assessment.status]}`}>
                      {assessment.status}
                    </span>
                  </div>

                  {assessment.description && (
                    <p className={styles.description}>{assessment.description}</p>
                  )}

                  {assessment.business_requirement && (
                    <div className={styles.cardInfo}>
                      <strong>Requirement:</strong> {assessment.business_requirement.substring(0, 100)}
                      {assessment.business_requirement.length > 100 ? "..." : ""}
                    </div>
                  )}

                  <div className={styles.cardFooter}>
                    <span className={styles.step}>
                      Step: <strong>{assessment.current_step_id.replace(/_/g, " ")}</strong>
                    </span>
                    <span className={styles.date}>
                      {new Date(assessment.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
