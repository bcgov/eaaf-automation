import db from "../lib/db/db";

const seedTPLAssessment = () => {
  console.log("Seeding TPL 2024 historical assessment...");

  const now = new Date().toISOString();

  // Create TPL assessment
  db.prepare(`
    INSERT INTO assessments (name, status, current_step_id, created_at, updated_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run("TPL 2024", "completed", "BUSINESS_OPS", now, now, now);

  const assessment = db.prepare(`SELECT id FROM assessments WHERE name = 'TPL 2024'`).get() as { id: number };
  const assessmentId = assessment.id;

  console.log(`Created TPL assessment ID: ${assessmentId}`);

  // Sample responses for TPL
  const sampleResponses = [
    { questionKey: "Q001", response: "Yes, solution aligns with approved business capabilities and enterprise standards" },
    { questionKey: "Q002", response: "Microservices architecture with event-driven patterns for scalability" },
    { questionKey: "Q003", response: "Cloud-first strategy with hybrid support for legacy systems" },
    { questionKey: "Q004", response: "GDPR compliant, data residency in EU, PII encryption required" },
    { questionKey: "Q005", response: "Yes, robust case management for case tracking and workflow automation" },
    { questionKey: "Q006", response: "IT operations, monitoring, alerting, and incident management capabilities critical" },
    { questionKey: "Q007", response: "5,000+ concurrent users during peak hours, 10,000+ total user base" },
    { questionKey: "Q008", response: "Salesforce CRM, ServiceNow ITSM, Active Directory, SAP backend systems" },
  ];

  for (const sample of sampleResponses) {
    const question = db.prepare(`SELECT id, step_id FROM questions WHERE question_key = ?`).get(sample.questionKey) as {
      id: number;
      step_id: number;
    };

    if (question) {
      db.prepare(`
        INSERT INTO responses (assessment_id, question_id, step_id, response_text, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(assessmentId, question.id, question.step_id, sample.response, now, now);
    }
  }

  // Create recommendation for TPL
  db.prepare(`
    INSERT INTO recommendations (assessment_id, platform_recommendation, rationale, confidence_score, risks, alternatives, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    assessmentId,
    "Salesforce with ServiceNow integration",
    "Strong case management need, cloud-first strategy, and large user base align perfectly with Salesforce. ServiceNow integration handles IT operations. GDPR compliance and data residency met with Salesforce EU regions.",
    92,
    "Custom integration complexity, high licensing costs, requires skilled Salesforce admins",
    "Microsoft Power Platform + Dynamics 365 (lower cost), Oracle Cloud (more on-prem friendly)",
    now
  );

  console.log(`✓ TPL assessment created with 8 responses and recommendation`);
};

seedTPLAssessment();
