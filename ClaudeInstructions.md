We need to have more concept based signaling. So for all such sections in eaaf-rules.json

Change from this
{
  "keywords": ["itsm", "it service management"],
  "scores": { "ServiceNow": 9, "Salesforce": -3 }
}

to 

{
  "concept": "Enterprise IT Service Management",
  "description": "The assessment requires comprehensive IT service management capabilities.",
  "whyItMatters": "Enterprise ITSM platforms provide mature incident, request, problem, change and SLA management capabilities.",
  "keywords": ["itsm", "it service management"],
  "scores": {
    "ServiceNow": 9,
    "Salesforce": -3
  }
}

do not change any scores
do not change the matching logic
group related rules under meaningful architectural concepts where appropriate.

Then UI in section 3 of the report 

Assessment Concept
Enterprise IT Service Management

Evidence Found
Incident management, service requests, change management and SLA requirements were identified in the assessment.

Architectural Interpretation
The solution requires a mature enterprise ITSM capability rather than a general CRM or lightweight workflow platform.

Why This Matters
Enterprise ITSM capabilities are a primary driver for platform selection.

Platform Impact
ServiceNow +9
Salesforce -3

Platform Impact
+9 ServiceNow
−3 Salesforce