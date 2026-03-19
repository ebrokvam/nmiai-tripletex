import type { SolveRequestBody } from "../types/solve.js";
import type { ParsedTask } from "../types/task-plan.js";

export function buildTaskPlan(input: SolveRequestBody): ParsedTask {
  const prompt = input.prompt.trim();

  // Minimal deterministic parser; replace with an LLM planner as you expand task coverage.
  const employee = parseCreateEmployee(prompt);
  if (employee) {
    return { kind: "create_employee", ...employee };
  }

  const customer = parseCreateCustomer(prompt);
  if (customer) {
    return { kind: "create_customer", ...customer };
  }

  const invoice = parseCreateInvoice(prompt);
  if (invoice) {
    return { kind: "create_invoice", ...invoice };
  }

  return {
    kind: "unknown",
    reason: "Could not match a supported task pattern.",
  };
}

function parseCreateEmployee(prompt: string):
  | { firstName: string; lastName: string; email?: string }
  | undefined {
  const employeeKeywords = [
    /create\s+employee/i,
    /opprett\s+en\s+ansatt/i,
    /lag\s+en\s+ansatt/i,
    /crear\s+empleado/i,
    /criar\s+funcion[aá]rio/i,
    /opprett\s+ein\s+tilsett/i,
    /mitarbeiter\s+erstellen/i,
    /cr[eé]er\s+employ[eé]/i,
  ];

  if (!employeeKeywords.some((regex) => regex.test(prompt))) {
    return undefined;
  }

  const email = prompt.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const firstNameField =
    prompt.match(/(?:first\s*name|fornavn|vorname|pr[eé]nom(?:bre)?|nombre)\s*[:=]?\s*([A-ZÆØÅ][\p{L}'-]+)/iu)
      ?.[1];
  const lastNameField =
    prompt.match(
      /(?:last\s*name|surname|etternavn|nachname|apellido|sobrenome|nom(?:bre)?\s+de\s+famille)\s*[:=]?\s*([A-ZÆØÅ][\p{L}'-]+)/iu,
    )?.[1];

  if (firstNameField && lastNameField) {
    return {
      firstName: firstNameField,
      lastName: lastNameField,
      email,
    };
  }

  const nameMatch =
    prompt.match(
      /(?:name|navn|nome|nombre|nom|employee|ansatt|tilsett|mitarbeiter|employ[eé]|funcion[aá]rio)\s+([A-ZÆØÅ][\p{L}'-]+)\s+([A-ZÆØÅ][\p{L}'-]+)/iu,
    ) ??
    prompt.match(/([A-ZÆØÅ][\p{L}'-]+)\s+([A-ZÆØÅ][\p{L}'-]+)/u);

  if (!nameMatch) {
    return undefined;
  }

  const firstName = nameMatch[1];
  const lastName = nameMatch[2];

  if (!firstName || !lastName) {
    return undefined;
  }

  return {
    firstName,
    lastName,
    email,
  };
}

function parseCreateCustomer(prompt: string):
  | { name: string; email?: string }
  | undefined {
  const customerKeywords = [
    /create\s+customer/i,
    /opprett\s+(en\s+)?kunde/i,
    /lag\s+(en\s+)?kunde/i,
    /crear\s+cliente/i,
    /criar\s+cliente/i,
    /opprett\s+(ein\s+)?kunde/i,
    /kunde\s+erstellen/i,
    /cr[eé]er\s+client/i,
  ];

  if (!customerKeywords.some((regex) => regex.test(prompt))) {
    return undefined;
  }

  const email = prompt.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const quoted = prompt.match(/["“”']([^"“”']{2,})["“”']/)?.[1];
  const fallback =
    prompt.match(/(?:customer|kunde|cliente|client)\s+([\p{L}0-9 .&'-]{2,})/iu)?.[1]?.trim();
  const name = quoted ?? fallback;

  if (!name) {
    return undefined;
  }

  return { name, email };
}

function parseCreateInvoice(prompt: string):
  | {
      customerName: string;
      customerEmail?: string;
      description: string;
      amount: number;
      quantity: number;
      invoiceDate?: string;
      dueDate?: string;
    }
  | undefined {
  const invoiceKeywords = [
    /create\s+invoice/i,
    /opprett\s+faktura/i,
    /lag\s+faktura/i,
    /crear\s+factura/i,
    /criar\s+fatura/i,
    /rechnung\s+erstellen/i,
    /cr[eé]er\s+facture/i,
  ];

  if (!invoiceKeywords.some((regex) => regex.test(prompt))) {
    return undefined;
  }

  const customerName =
    prompt.match(/["“”']([^"“”']{2,})["“”']/)?.[1]?.trim() ??
    prompt
      .match(
        /(?:for|til|a|para|pour)\s+(?:customer|kunde|cliente|client)\s+([\p{L}0-9 .&'-]{2,})/iu,
      )?.[1]
      ?.trim() ??
    prompt.match(/(?:customer|kunde|cliente|client)\s+([\p{L}0-9 .&'-]{2,})/iu)?.[1]?.trim();

  if (!customerName) {
    return undefined;
  }

  const customerEmail = prompt.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const amount = parseAmount(prompt) ?? 1000;
  const quantity = parseQuantity(prompt) ?? 1;
  const description =
    prompt.match(/(?:description|beskrivelse|descri[cç][aã]o|descripci[oó]n|beschreibung)\s*[:=]?\s*([^,.]+)/iu)
      ?.[1]
      ?.trim() ?? "Consulting services";

  const dates = [...prompt.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g)].map((value) => value[1]);
  const invoiceDate = dates[0];
  const dueDate = dates[1] ?? dates[0];

  return {
    customerName,
    customerEmail,
    description,
    amount,
    quantity,
    invoiceDate,
    dueDate,
  };
}

function parseAmount(prompt: string): number | undefined {
  const raw =
    prompt.match(/(\d+[.,]\d{1,2}|\d+)\s*(?:kr|nok|eur|usd|€|\$)\b/i)?.[1] ??
    prompt.match(/(?:amount|bel[øo]p|importe|valor|montant)\s*[:=]?\s*(\d+[.,]\d{1,2}|\d+)/iu)?.[1];

  if (!raw) {
    return undefined;
  }

  const normalized = Number(raw.replace(",", "."));
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return undefined;
  }

  return normalized;
}

function parseQuantity(prompt: string): number | undefined {
  const raw =
    prompt.match(/(?:qty|quantity|antall|cantidad|quantidade|anzahl|quantit[eé])\s*[:=]?\s*(\d+)/iu)
      ?.[1] ?? prompt.match(/\b(\d+)\s*(?:stk|pcs|units?)\b/i)?.[1];
  if (!raw) {
    return undefined;
  }

  const quantity = Number(raw);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return undefined;
  }
  return quantity;
}
