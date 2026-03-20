export type PlannedRequest = {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  purpose: string;
  query_hint?: string | null;
  body_hint?: string | null;
};

export type PlannedArgument = {
  name: string;
  value: string;
};

export type PlannedTask = {
  status: "planned";
  summary: string;
  intent: string;
  input_arguments: PlannedArgument[];
  lookup_requests: PlannedRequest[];
  mutation_requests: PlannedRequest[];
  verification_requests: PlannedRequest[];
  stop_conditions: string[];
};

export type UnplannableTask = {
  status: "cannot_plan";
  reason: string;
  summary?: string;
};

export type AgentTaskPlan = PlannedTask | UnplannableTask;
