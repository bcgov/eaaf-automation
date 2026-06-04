Create a full-stack local-first Enterprise Architecture Assessment application using:

- Next.js 15 (App Router)
- TypeScript
- Node.js runtime (server actions or API routes)
- SQLite using better-sqlite3
- No authentication
- No external services
- No AI or embeddings

The application must implement a guided EA workflow:

Architecture Assessment → Cloud Assessment → Platform Assessment → Business & Operations Assessment → Recommendation

Each assessment is step-based and sequential, not a flat questionnaire.

---------------------------
DATABASE REQUIREMENTS
---------------------------

Create a SQLite database with a complete schema that supports:

1. Multiple assessments over time
2. Step-based workflow navigation
3. Free text questions and answers
4. Versioning of assessments
5. Historical comparison (future-ready)
6. Recommendation storage per assessment
7. Audit trail of changes

---------------------------
TABLES (FULL SCHEMA)
---------------------------

1. assessments
- id (primary key)
- name (text)
- description (text, optional)
- status (draft | in_progress | completed | archived)
- current_step_id (text or foreign key)
- created_at (datetime)
- updated_at (datetime)
- completed_at (datetime nullable)

2. assessment_steps
- id (primary key)
- key (text unique, e.g. architecture, cloud, platform, business_ops)
- name (text)
- sequence (integer)
- description (text)

3. questions
- id (primary key)
- step_id (foreign key)
- question_key (text unique)
- factor (text category grouping)
- question_text (text)
- help_text (text nullable)
- input_type (text: free_text only for now)
- sequence (integer)

4. responses
- id (primary key)
- assessment_id (foreign key)
- question_id (foreign key)
- step_id (foreign key)
- response_text (text)
- created_at (datetime)
- updated_at (datetime)

5. assessment_step_state
- id (primary key)
- assessment_id (foreign key)
- step_id (foreign key)
- status (not_started | in_progress | completed)
- started_at (datetime)
- completed_at (datetime)

6. recommendations
- id (primary key)
- assessment_id (foreign key)
- platform_recommendation (text)
- rationale (text)
- confidence_score (number 0-100)
- risks (text)
- alternatives (text)
- created_at (datetime)

7. assessment_history
- id (primary key)
- assessment_id (foreign key)
- snapshot_json (text)
- created_at (datetime)

---------------------------
SEED DATA REQUIREMENTS
---------------------------

Create seed scripts that insert:

1. 4 steps in correct order:
- Architecture Assessment
- Cloud Assessment
- Platform Assessment
- Business & Operations Assessment

2. At least 2 sample questions per step
All questions must be free text only.

---------------------------
APPLICATION REQUIREMENTS
---------------------------

1. Home page:
- List all assessments
- Button: Create New Assessment

2. Create assessment flow:
- Insert assessment record
- Initialize step states
- Redirect to /assessment/[id]

3. Assessment page:
- Shows current step
- Shows all questions in that step
- Captures free text responses
- Saves responses to SQLite immediately

4. Navigation:
- Next Step button
- Previous Step button
- Step progress indicator

5. State rules:
- Only one active step at a time
- Completing a step unlocks next step
- Assessment cannot skip steps

6. Recommendation page:
- Simple stub function only
- Based on keyword matching in responses:
  - “case management” → Salesforce
  - “IT operations” → ServiceNow
  - “low code” → Power Platform
- Store result in recommendations table

---------------------------
TECHNICAL REQUIREMENTS
---------------------------

- Use server-side SQLite only (no client DB)
- Use clean service layer:
  /lib/db
  /lib/services
  /lib/workflow
- Separate:
  - data access
  - business logic
  - UI components

- No styling framework
- Minimal UI only
- Ensure everything runs locally with:
  npm install
  npm run dev

---------------------------
NON-FUNCTIONAL REQUIREMENTS
---------------------------

- Code must be modular
- No hardcoding logic in UI components
- Must support future embedding + AI integration without schema rewrite
- Must support historical comparisons later
- Must be easy to extend workflow steps

---------------------------
OUTPUT EXPECTATION
---------------------------

Generate:
- Full folder structure
- All code files
- Database initialization
- Seed scripts
- Working UI pages
- Working routing between steps

The end result must be a fully functional local application that runs end-to-end with SQLite persistence and a working multi-step EA workflow.