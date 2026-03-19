import type {
  TripletexCustomer,
  TripletexEmployee,
  TripletexInvoice,
  TripletexListResponse,
  TripletexOrder,
  TripletexValueResponse,
} from "../types/tripletex.js";
import type { TripletexCredentials } from "../types/solve.js";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

type RequestOptions = {
  method?: HttpMethod;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
};

export class TripletexClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;

  constructor(credentials: TripletexCredentials) {
    this.baseUrl = credentials.base_url.replace(/\/+$/, "");
    this.authHeader = this.toBasicAuth("0", credentials.session_token);
  }

  async listEmployees(): Promise<TripletexEmployee[]> {
    const response = await this.request<TripletexListResponse<TripletexEmployee>>("/employee", {
      query: { fields: "id,firstName,lastName,email" },
    });

    return response.values ?? [];
  }

  async createEmployee(input: {
    firstName: string;
    lastName: string;
    email?: string;
    userType?: "STANDARD" | "EXTENDED" | "NO_ACCESS";
  }): Promise<TripletexEmployee> {
    const response = await this.request<TripletexValueResponse<TripletexEmployee>>("/employee", {
      method: "POST",
      body: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        userType: input.userType ?? "STANDARD",
      },
    });

    return response.value;
  }

  async createCustomer(input: { name: string; email?: string }): Promise<TripletexCustomer> {
    const response = await this.request<TripletexValueResponse<TripletexCustomer>>("/customer", {
      method: "POST",
      body: {
        name: input.name,
        email: input.email,
      },
    });

    return response.value;
  }

  async findCustomers(input: { name: string; count?: number }): Promise<TripletexCustomer[]> {
    const response = await this.request<TripletexListResponse<TripletexCustomer>>("/customer", {
      query: {
        name: input.name,
        count: input.count ?? 10,
        fields: "id,name,email",
      },
    });
    return response.values ?? [];
  }

  async createOrder(input: {
    customerId: number;
    description: string;
    unitPriceExcludingVatCurrency: number;
    quantity: number;
    orderDate?: string;
    deliveryDate?: string;
  }): Promise<TripletexOrder> {
    const response = await this.request<TripletexValueResponse<TripletexOrder>>("/order", {
      method: "POST",
      body: {
        customer: { id: input.customerId },
        orderDate: input.orderDate ?? todayDate(),
        deliveryDate: input.deliveryDate ?? input.orderDate ?? todayDate(),
        orderLines: [
          {
            description: input.description,
            count: input.quantity,
            unitPriceExcludingVatCurrency: input.unitPriceExcludingVatCurrency,
          },
        ],
      },
    });
    return response.value;
  }

  async createInvoice(input: {
    customerId: number;
    orderIds: number[];
    invoiceDate?: string;
    dueDate?: string;
  }): Promise<TripletexInvoice> {
    const response = await this.request<TripletexValueResponse<TripletexInvoice>>("/invoice", {
      method: "POST",
      body: {
        customer: { id: input.customerId },
        orders: input.orderIds.map((id) => ({ id })),
        invoiceDate: input.invoiceDate ?? todayDate(),
        invoiceDueDate: input.dueDate ?? input.invoiceDate ?? todayDate(),
      },
    });
    return response.value;
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const method = options.method ?? "GET";
    const url = new URL(`${this.baseUrl}${path}`);

    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const text = await response.text();
    const json = text ? safeJsonParse(text) : undefined;

    if (!response.ok) {
      throw new Error(
        `Tripletex ${method} ${path} failed (${response.status}): ${text || response.statusText}`,
      );
    }

    return json as T;
  }

  private toBasicAuth(username: string, password: string): string {
    const token = Buffer.from(`${username}:${password}`, "utf8").toString("base64");
    return `Basic ${token}`;
  }
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}
