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
    business_goals: assessment.business_goals || "",
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
      business_goals: assessment.business_goals || "",
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
            <label>Business Goals</label>
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
            <label>Business Drivers</label>
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

  const contextFields = [
    { key: "business_requirement" as const, label: "Requirement",     icon: "📋", color: "#1a73e8", bg: "#e8f0fe" },
    { key: "business_context"    as const, label: "Context",          icon: "👥", color: "#137333", bg: "#e6f4ea" },
    { key: "business_goals"      as const, label: "Strategic Goals",   icon: "🎯", color: "#7b2d8b", bg: "#f3e8fd" },
    { key: "business_drivers"    as const, label: "Business Drivers",  icon: "📈", color: "#e37400", bg: "#fef3e2" },
  ];

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerIcon}>🏛</span>
          <h2 className={styles.headerTitle}>Business Context</h2>
        </div>
        <div className={styles.headerActions}>
          <button onClick={() => setIsEditing(true)} className={styles.editButton}>
            ✏ Edit
          </button>
          <button className={styles.moreButton} title="More options">⋮</button>
        </div>
      </div>

      <div className={styles.fieldRows}>
        {contextFields.map((f) => (
          <div key={f.key} className={styles.fieldRow}>
            <div className={styles.fieldLabelCol}>
              <span className={styles.fieldIconBadge} style={{ background: f.bg, color: f.color }}>{f.icon}</span>
              <span className={styles.fieldLabel} style={{ color: f.color }}>{f.label}</span>
            </div>
            <div className={styles.fieldValue}>
              {assessment[f.key]
                ? <p>{assessment[f.key]}</p>
                : <span className={styles.fieldEmpty}>Not specified</span>
              }
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
