// Assessment type definitions

export type AssessmentStatus = "draft" | "in_progress" | "completed" | "archived";

export type StepKey =
  | "ARCHITECTURE"
  | "CLOUD_ASSESSMENT"
  | "PLATFORM_ASSESSMENT"
  | "OPERATIONAL_CONSIDERATIONS"
  | "FINAL_RECOMMENDATION";

export interface Assessment {
  id: number;
  name: string;
  description?: string;
  status: AssessmentStatus;
  current_step_id: StepKey;
  business_context?: string;
  business_goals?: string;
  business_drivers?: string;
  business_requirement?: string;
  business_goal?: string;
  business_driver?: string;
  recommendation?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface CreateAssessmentRequest {
  name: string;
  description?: string;
  business_context?: string;
  business_goals?: string;
  business_drivers?: string;
  business_requirement?: string;
  business_goal?: string;
  business_driver?: string;
}

export interface UpdateAssessmentRequest {
  name?: string;
  description?: string;
  current_step_id?: StepKey;
  business_context?: string;
  business_goals?: string;
  business_drivers?: string;
  business_requirement?: string;
  business_goal?: string;
  business_driver?: string;
  status?: AssessmentStatus;
}

export interface AssessmentResponse extends Assessment {}

export interface Question {
  id: number;
  question_key: string;
  question_text: string;
  help_text?: string;
  input_type: string;
  step_key: StepKey;
  factor?: string;
  factorId?: string;
  subFactorId?: string;
}

export interface Response {
  id: number;
  assessment_id: number;
  question_id: number;
  response_text: string;
  created_at: string;
  updated_at: string;
}

export interface SaveResponseRequest {
  question_id: number;
  response_text: string;
}

export interface Recommendation {
  id: number;
  assessment_id: number;
  platform_recommendation: string;
  rationale: string;
  confidence_score: number;
  risks: string;
  alternatives: string;
  created_at: string;
}

export interface AssessmentStep {
  id: number;
  key: StepKey;
  name: string;
  sequence: number;
  description?: string;
}
