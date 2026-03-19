import type { SolveRequestBody } from "../types/solve.js";
import type { ParsedTask } from "../types/task-plan.js";

type ChatCompletionsResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

const TASK_SCHEMA = {
  name: "parsed_task",
  strict: false,
  schema: {
    type: "object",
    properties: {
      kind: {
        type: "string",
        enum: ["create_employee", "create_customer", "create_invoice", "unknown"],
      },
      firstName: { type: "string" },
      lastName: { type: "string" },
      email: { type: "string" },
      name: { type: "string" },
      customerName: { type: "string" },
      customerEmail: { type: "string" },
      description: { type: "string" },
      amount: { type: "number" },
      quantity: { type: "number" },
      invoiceDate: { type: "string" },
      dueDate: { type: "string" },
      reason: { type: "string" },
    },
    required: ["kind"],
  },
} as const;

export async function buildTaskPlanWithLLM(input: SolveRequestBody): Promise<ParsedTask | undefined> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.info("[solver] llm planner unavailable: OPENAI_API_KEY is missing");
    return undefined;
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-5-mini";
  const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "");

  const filesSummary = (input.files ?? []).map((file) => ({
    filename: file.filename,
    mime_type: file.mime_type,
    content_base64_length: file.content_base64.length,
  }));

  const payload = {
    prompt: input.prompt,
    files: filesSummary,
    instructions: [
      "Extract the task into one of the supported kinds.",
      "If information is missing or the task is unsupported, return kind=unknown with a short reason.",
      "Do not invent fields that are not in the prompt.",
      "Supported languages include Norwegian, English, Spanish, Portuguese, Nynorsk, German, French.",
      "If creating invoice and quantity is missing, use 1.",
    ],
  };

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a Tripletex task parser. Return only structured data that matches the JSON schema.",
        },
        {
          role: "user",
          content: JSON.stringify(payload),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: TASK_SCHEMA,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.warn(
      `[solver] llm planner request failed: status=${response.status} body=${errorBody.slice(0, 500)}`,
    );
    return undefined;
  }

  const json = (await response.json()) as ChatCompletionsResponse;
  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    console.warn("[solver] llm planner response missing message content");
    return undefined;
  }

  const parsed = safeJsonParse(content);
  const normalized = normalizeParsedTask(parsed);
  if (!normalized) {
    console.warn(
      `[solver] llm planner response did not match ParsedTask schema, raw=${content.slice(0, 500)}`,
    );
    return undefined;
  }

  return normalized;
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function isParsedTask(value: unknown): value is ParsedTask {
  if (!value || typeof value !== "object") {
    return false;
  }

  const input = value as Record<string, unknown>;
  if (typeof input.kind !== "string") {
    return false;
  }

  switch (input.kind) {
    case "create_employee":
      return typeof input.firstName === "string" && typeof input.lastName === "string";
    case "create_customer":
      return typeof input.name === "string";
    case "create_invoice":
      return (
        typeof input.customerName === "string" &&
        typeof input.description === "string" &&
        typeof input.amount === "number" &&
        Number.isFinite(input.amount) &&
        input.amount > 0 &&
        typeof input.quantity === "number" &&
        Number.isFinite(input.quantity) &&
        input.quantity > 0
      );
    case "unknown":
      return typeof input.reason === "string" || input.reason === undefined;
    default:
      return false;
  }
}

function normalizeParsedTask(value: unknown): ParsedTask | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const input = value as Record<string, unknown>;
  const rawKind = String(input.kind ?? input.taskKind ?? input.action ?? "").trim();
  const kind = normalizeKind(rawKind);

  if (kind === "create_employee") {
    const firstName = stringField(input.firstName);
    const lastName = stringField(input.lastName);
    if (firstName && lastName) {
      return {
        kind,
        firstName,
        lastName,
        email: stringField(input.email),
      };
    }
    return undefined;
  }

  if (kind === "create_customer") {
    const name = stringField(input.name) ?? stringField(input.customerName) ?? stringField(input.customer);
    if (!name) {
      return undefined;
    }
    return {
      kind,
      name,
      email: stringField(input.email) ?? stringField(input.customerEmail),
    };
  }

  if (kind === "create_invoice") {
    const customerName =
      stringField(input.customerName) ?? stringField(input.name) ?? stringField(input.customer);
    const description = stringField(input.description) ?? "Consulting services";
    const amount = numberField(input.amount) ?? numberField(input.total);
    const quantity = numberField(input.quantity) ?? 1;
    if (!customerName || !amount || amount <= 0 || !quantity || quantity <= 0) {
      return undefined;
    }
    return {
      kind,
      customerName,
      customerEmail: stringField(input.customerEmail) ?? stringField(input.email),
      description,
      amount,
      quantity,
      invoiceDate: stringField(input.invoiceDate),
      dueDate: stringField(input.dueDate),
    };
  }

  return {
    kind: "unknown",
    reason: stringField(input.reason) ?? "LLM could not confidently classify task",
  };
}

function normalizeKind(kind: string): ParsedTask["kind"] {
  const normalized = kind.toLowerCase();
  if (["create_employee", "createemployee", "employee_create"].includes(normalized)) {
    return "create_employee";
  }
  if (["create_customer", "createcustomer", "customer_create"].includes(normalized)) {
    return "create_customer";
  }
  if (["create_invoice", "createinvoice", "invoice_create"].includes(normalized)) {
    return "create_invoice";
  }
  return "unknown";
}

function stringField(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function numberField(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const asNumber = Number(value.replace(",", "."));
    if (Number.isFinite(asNumber)) {
      return asNumber;
    }
  }
  return undefined;
}
