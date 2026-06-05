"use client";

import { useState, useEffect } from "react";
import {
  getAssessmentWithStep,
  getQuestionsForStep,
  getResponsesForAssessment,
  getNextStep,
  getPreviousStep,
  getAllSteps,
  type StepKey,
} from "@/lib/workflow/step-navigation";

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
  key: StepKey;
  name: string;
  sequence: number;
}

export default function AssessmentPage({ params }: { params: { id: string } }) {
  const assessmentId = parseInt(params.id);

  const [assessment, setAssessment] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [allSteps, setAllSteps] = useState<StepInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Fetch assessment
        const assessmentRes = await fetch(`/api/assessment/${assessmentId}`);
        const assessmentData = await assessmentRes.json();
        setAssessment(assessmentData);

        // Fetch questions for current step
        const questionsRes = await fetch(`/api/questions?step=${assessmentData.current_step_id}`);
        const questionsData = await questionsRes.json();
        setQuestions(questionsData);

        // Fetch existing responses
        const responsesRes = await fetch(`/api/responses?assessmentId=${assessmentId}`);
        const responsesData = await responsesRes.json();
        setResponses(responsesData);

        // Fetch all steps for progress indicator
        const stepsRes = await fetch("/api/steps");
        const stepsData = await stepsRes.json();
        setAllSteps(stepsData);
      } catch (err) {
        console.error("Failed to load assessment:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [assessmentId]);

  const handleResponseChange = (questionKey: string, value: string) => {
    setResponses((prev) => ({
      ...prev,
      [questionKey]: value,
    }));
  };

  const saveResponse = async (questionKey: string) => {
    setSaving(true);
    try {
      await fetch("/api/response/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentId,
          questionKey,
          value: responses[questionKey],
        }),
      });
    } catch (err) {
      console.error("Failed to save response:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    try {
      const res = await fetch(`/api/assessment/${assessmentId}/next`, { method: "POST" });
      const data = await res.json();
      window.location.reload();
    } catch (err) {
      console.error("Failed to advance step:", err);
    }
  };

  const handlePrevious = async () => {
    try {
      const res = await fetch(`/api/assessment/${assessmentId}/previous`, { method: "POST" });
      const data = await res.json();
      window.location.reload();
    } catch (err) {
      console.error("Failed to go to previous step:", err);
    }
  };

  if (loading) {
    return <div style={{ padding: "20px" }}>Loading...</div>;
  }

  if (!assessment) {
    return <div style={{ padding: "20px" }}>Assessment not found</div>;
  }

  const currentStepIndex = allSteps.findIndex((s) => s.key === assessment.current_step_id);
  const hasNext = currentStepIndex < allSteps.length - 1;
  const hasPrevious = currentStepIndex > 0;

  return (
    <div style={{ padding: "20px", maxWidth: "800px", margin: "0 auto" }}>
      <h1>{assessment.name}</h1>

      {/* Progress Indicator */}
      <div style={{ marginBottom: "30px" }}>
        <div style={{ display: "flex", gap: "10px" }}>
          {allSteps.map((step, idx) => (
            <div
              key={step.id}
              style={{
                flex: 1,
                padding: "10px",
                textAlign: "center",
                backgroundColor: idx <= currentStepIndex ? "#4CAF50" : "#ddd",
                color: idx <= currentStepIndex ? "white" : "black",
                borderRadius: "4px",
              }}
            >
              {step.name}
            </div>
          ))}
        </div>
      </div>

      {/* Current Step */}
      <h2>{allSteps[currentStepIndex]?.name}</h2>

      {/* Questions */}
      <div style={{ marginBottom: "30px" }}>
        {questions.map((q) => (
          <div key={q.id} style={{ marginBottom: "20px", padding: "10px", border: "1px solid #ddd", borderRadius: "4px" }}>
            <label style={{ fontWeight: "bold", display: "block", marginBottom: "8px" }}>
              {q.question_key}: {q.question_text}
            </label>
            {q.help_text && (
              <p style={{ fontSize: "12px", color: "#666", marginBottom: "8px" }}>
                {q.help_text}
              </p>
            )}
            <textarea
              value={responses[q.question_key] || ""}
              onChange={(e) => handleResponseChange(q.question_key, e.target.value)}
              onBlur={() => saveResponse(q.question_key)}
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                fontFamily: "monospace",
              }}
              rows={4}
            />
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div style={{ display: "flex", gap: "10px", justifyContent: "space-between" }}>
        <button
          onClick={handlePrevious}
          disabled={!hasPrevious}
          style={{
            padding: "10px 20px",
            cursor: hasPrevious ? "pointer" : "not-allowed",
            opacity: hasPrevious ? 1 : 0.5,
          }}
        >
          Previous Step
        </button>
        <button
          onClick={handleNext}
          disabled={!hasNext}
          style={{
            padding: "10px 20px",
            cursor: hasNext ? "pointer" : "not-allowed",
            opacity: hasNext ? 1 : 0.5,
          }}
        >
          Next Step
        </button>
      </div>
    </div>
  );
}
