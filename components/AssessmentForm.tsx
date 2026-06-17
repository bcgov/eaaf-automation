"use client";

import { useState, FormEvent } from "react";
import { CreateAssessmentRequest, Assessment } from "@/types/assessment";
import styles from "./AssessmentForm.module.css";

interface AssessmentFormProps {
  assessment?: Assessment;
  onSubmit: (formData: CreateAssessmentRequest | Assessment) => void;
  isLoading?: boolean;
  mode?: "create" | "edit";
}

export default function AssessmentForm({
  assessment,
  onSubmit,
  isLoading = false,
  mode = "create",
}: AssessmentFormProps) {
  const [formData, setFormData] = useState({
    name: assessment?.name || "",
    description: assessment?.description || "",
    business_context: assessment?.business_context || "",
    business_goals: assessment?.business_goals || "",
    business_drivers: assessment?.business_drivers || "",
    business_requirement: assessment?.business_requirement || "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.section}>
        <h2>Basic Information</h2>

        <div className={styles.formGroup}>
          <label htmlFor="name">Assessment Name *</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            placeholder="e.g., TPL 2024, Platform Modernization"
            className={styles.input}
          />
          <small>Give your assessment a clear, descriptive name</small>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Optional: Brief overview of the assessment scope"
            className={styles.textarea}
            rows={3}
          />
        </div>
      </div>

      <div className={styles.section}>
        <h2>Business Context</h2>

        <div className={styles.formGroup}>
          <label htmlFor="business_context">Context</label>
          <textarea
            id="business_context"
            name="business_context"
            value={formData.business_context}
            onChange={handleChange}
            placeholder="Describe the overall business context: digital transformation, legacy system replacement, new capability, etc."
            className={styles.textarea}
            rows={4}
          />
          <small>What is the strategic context for this assessment?</small>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="business_requirement">Business Requirement *</label>
          <textarea
            id="business_requirement"
            name="business_requirement"
            value={formData.business_requirement}
            onChange={handleChange}
            placeholder="e.g., Multi-tenant case management platform with advanced workflow orchestration"
            className={styles.textarea}
            rows={3}
          />
          <small>What is the primary business requirement or use case?</small>
        </div>
      </div>

      <div className={styles.section}>
        <h2>Business Goals & Drivers</h2>

        <div className={styles.formGroup}>
          <label htmlFor="business_goals">Business Goals</label>
          <textarea
            id="business_goals"
            name="business_goals"
            value={formData.business_goals}
            onChange={handleChange}
            placeholder="List multiple goals separated by newlines or numbers:&#10;1) Migrate to cloud-first architecture&#10;2) Support 5,000+ concurrent users&#10;3) Deep enterprise integration"
            className={styles.textarea}
            rows={4}
          />
          <small>List strategic goals (one per line or numbered). Include your primary goal first.</small>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="business_drivers">Business Drivers</label>
          <textarea
            id="business_drivers"
            name="business_drivers"
            value={formData.business_drivers}
            onChange={handleChange}
            placeholder="List multiple drivers separated by newlines or numbers:&#10;1) Government digital transformation&#10;2) Cost reduction through SaaS&#10;3) Compliance requirements"
            className={styles.textarea}
            rows={4}
          />
          <small>List business drivers (one per line or numbered). Include your primary driver first.</small>
        </div>
      </div>

      <div className={styles.actions}>
        <button
          type="submit"
          disabled={isLoading}
          className={styles.submitButton}
        >
          {isLoading ? "Saving..." : mode === "create" ? "Create Assessment" : "Update Assessment"}
        </button>
      </div>
    </form>
  );
}
