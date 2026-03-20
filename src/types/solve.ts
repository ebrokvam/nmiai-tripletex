export type IncomingFile = {
  filename: string;
  content_base64: string;
  mime_type: string;
};

export type TripletexCredentials = {
  base_url: string;
  session_token: string;
};

export type SolveRequestBody = {
  prompt: string;
  files?: IncomingFile[];
  tripletex_credentials: TripletexCredentials;
};

export type SolveResponseBody = {
  status: "completed";
  debug?: {
    ok: boolean;
    planner?: "llm";
    plan_summary?: string;
    planning_error?: string;
    error?: string;
  };
};
