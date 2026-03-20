export type PlannedRequest = {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  purpose: string;
  query_json?: string | null;
  body_json?: string | null;
  format_requirements: string[];
};

export type PlannedTask = {
  lookup_requests: PlannedRequest[];
  mutation_requests: PlannedRequest[];
  planning_error?: string | null;
};
export type AgentTaskPlan = PlannedTask;
