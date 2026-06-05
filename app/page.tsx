"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Assessment {
  id: number;
  name: string;
  status: string;
  current_step_id: string;
  created_at: string;
}

export default function HomePage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

    loadAssessments();
  }, []);

  const handleCreateNew = async () => {
    try {
      const res = await fetch("/api/assessment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      // Redirect to the new assessment
      window.location.href = `/assessment/${data.id}`;
    } catch (err) {
      console.error("Failed to create assessment:", err);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "20px" }}>
        <h1>Enterprise Architecture Assessment</h1>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", maxWidth: "900px", margin: "0 auto" }}>
      <h1>Enterprise Architecture Assessment</h1>

      <div style={{ marginBottom: "30px" }}>
        <button
          onClick={handleCreateNew}
          style={{
            padding: "12px 24px",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: "bold",
          }}
        >
          + Create New Assessment
        </button>
      </div>

      {assessments.length === 0 ? (
        <p>No assessments yet. Click the button above to create one.</p>
      ) : (
        <div>
          <h2>Your Assessments</h2>
          <div style={{ display: "grid", gap: "15px" }}>
            {assessments.map((assessment) => (
              <Link
                key={assessment.id}
                href={`/assessment/${assessment.id}`}
                style={{
                  padding: "15px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  textDecoration: "none",
                  color: "inherit",
                  backgroundColor: "#f9f9f9",
                  transition: "background-color 0.2s",
                  cursor: "pointer",
                  display: "block",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f0f0f0")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f9f9f9")}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h3 style={{ margin: "0 0 5px 0" }}>{assessment.name}</h3>
                    <p style={{ margin: "0", fontSize: "12px", color: "#666" }}>
                      Created: {new Date(assessment.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "5px 10px",
                        backgroundColor: assessment.status === "completed" ? "#4CAF50" : "#FFC107",
                        color: "white",
                        borderRadius: "3px",
                        fontSize: "12px",
                        marginRight: "10px",
                      }}
                    >
                      {assessment.status}
                    </span>
                    <span style={{ fontSize: "14px", fontWeight: "bold" }}>
                      {assessment.current_step_id}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
