"use client";

import { useState } from "react";
import { Assessment } from "@/types/assessment";
import styles from "./BusinessContextPanel.module.css";

interface BusinessContextPanelProps {
  assessment: Assessment;
  onUpdate: (updates: Partial<Assessment>) => void;
  isEditing?: boolean;
  isSaving?: boolean;
}

export default function BusinessContextPanel({
  assessment,
  onUpdate,
  isEditing: initialEditing = false,
  isSaving = false,
}: BusinessContextPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(initialEditing);
  const [formData, setFormData] = useState({
    business_context: assessment.business_context || "",
    business_goal: assessment.business_goal || "",
    business_goals: assessment.business_goals || "",
    business_driver: assessment.business_driver || "",
    business_drivers: assessment.business_drivers || "",
    business_requirement: assessment.business_requirement || "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSave = () => {
    onUpdate(formData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData({
      business_context: assessment.business_context || "",
      business_goal: assessment.business_goal || "",
      business_goals: assessment.business_goals || "",
      business_driver: assessment.business_driver || "",
      business_drivers: assessment.business_drivers || "",
      business_requirement: assessment.business_requirement || "",
    });
    setIsEditing(false);
  };

  if (!isExpanded) {
    return (
      <div className={styles.collapsed}>
        <button
          onClick={() => setIsExpanded(true)}
          className={styles.expandButton}
        >
          ▶ Business Context ({assessment.business_requirement ? "✓" : "✗"})
        </button>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>
          <h2>Business Context</h2>
          <button
            onClick={() => setIsExpanded(false)}
            className={styles.collapseButton}
          >
            ▼
          </button>
        </div>

        <div className={styles.editForm}>
          <div className={styles.formGroup}>
            <label>Context</label>
            <textarea
              name="business_context"
              value={formData.business_context}
              onChange={handleChange}
              rows={3}
              className={styles.textarea}
            />
          </div>

          <div className={styles.row}>
            <div className={styles.formGroup}>
              <label>Primary Goal *</label>
              <textarea
                name="business_goal"
                value={formData.business_goal}
                onChange={handleChange}
                rows={2}
                className={styles.textarea}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Primary Driver</label>
              <textarea
                name="business_driver"
                value={formData.business_driver}
                onChange={handleChange}
                rows={2}
                className={styles.textarea}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Requirement *</label>
            <textarea
              name="business_requirement"
              value={formData.business_requirement}
              onChange={handleChange}
              rows={2}
              className={styles.textarea}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Goals (Multiple)</label>
            <textarea
              name="business_goals"
              value={formData.business_goals}
              onChange={handleChange}
              rows={3}
              className={styles.textarea}
              placeholder="List goals separated by newlines"
            />
          </div>

          <div className={styles.formGroup}>
            <label>Drivers (Multiple)</label>
            <textarea
              name="business_drivers"
              value={formData.business_drivers}
              onChange={handleChange}
              rows={3}
              className={styles.textarea}
              placeholder="List drivers separated by newlines"
            />
          </div>

          <div className={styles.actions}>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={styles.saveButton}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className={styles.cancelButton}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2>Business Context</h2>
        <div className={styles.headerActions}>
          <button
            onClick={() => setIsEditing(true)}
            className={styles.editButton}
          >
            Edit
          </button>
          <button
            onClick={() => setIsExpanded(false)}
            className={styles.collapseButton}
          >
            ▼
          </button>
        </div>
      </div>

      <div className={styles.content}>
        {assessment.business_requirement && (
          <div className={styles.field}>
            <strong>Requirement:</strong>
            <p>{assessment.business_requirement}</p>
          </div>
        )}

        {assessment.business_goal && (
          <div className={styles.field}>
            <strong>Primary Goal:</strong>
            <p>{assessment.business_goal}</p>
          </div>
        )}

        {assessment.business_driver && (
          <div className={styles.field}>
            <strong>Primary Driver:</strong>
            <p>{assessment.business_driver}</p>
          </div>
        )}

        {assessment.business_context && (
          <div className={styles.field}>
            <strong>Context:</strong>
            <p>{assessment.business_context}</p>
          </div>
        )}

        {assessment.business_goals && (
          <div className={styles.field}>
            <strong>Strategic Goals:</strong>
            <p style={{ whiteSpace: "pre-wrap" }}>{assessment.business_goals}</p>
          </div>
        )}

        {assessment.business_drivers && (
          <div className={styles.field}>
            <strong>Business Drivers:</strong>
            <p style={{ whiteSpace: "pre-wrap" }}>{assessment.business_drivers}</p>
          </div>
        )}

        {!assessment.business_requirement && (
          <p className={styles.placeholder}>No business context defined yet. Click Edit to add details.</p>
        )}
      </div>
    </div>
  );
}
