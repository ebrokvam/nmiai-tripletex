import { TripletexClient } from "../../tripletex/client.js";
import type { ExecutableTask } from "../../types/task-plan.js";

type TaskHandler<T extends ExecutableTask = ExecutableTask> = (
  client: TripletexClient,
  task: T,
) => Promise<void>;

const handlers: {
  [K in ExecutableTask["kind"]]: TaskHandler<Extract<ExecutableTask, { kind: K }>>;
} = {
  create_employee: async (client, task) => {
    await client.createEmployee({
      firstName: task.firstName,
      lastName: task.lastName,
      email: task.email,
    });
  },
  create_customer: async (client, task) => {
    await client.createCustomer({
      name: task.name,
      email: task.email,
    });
  },
  create_invoice: async (client, task) => {
    const customer = await resolveOrCreateCustomer(client, task.customerName, task.customerEmail);
    const order = await client.createOrder({
      customerId: customer.id,
      description: task.description,
      unitPriceExcludingVatCurrency: task.amount,
      quantity: task.quantity,
      orderDate: task.invoiceDate,
      deliveryDate: task.invoiceDate,
    });

    await client.createInvoice({
      customerId: customer.id,
      orderIds: [order.id],
      invoiceDate: task.invoiceDate,
      dueDate: task.dueDate,
    });
  },
};

export async function executeTask(client: TripletexClient, task: ExecutableTask): Promise<void> {
  switch (task.kind) {
    case "create_employee":
      await handlers.create_employee(client, task);
      return;
    case "create_customer":
      await handlers.create_customer(client, task);
      return;
    case "create_invoice":
      await handlers.create_invoice(client, task);
      return;
  }
}

async function resolveOrCreateCustomer(
  client: TripletexClient,
  name: string,
  email?: string,
): Promise<{ id: number }> {
  const candidates = await client.findCustomers({ name, count: 10 });
  const exactMatch = candidates.find(
    (customer) => customer.name?.trim().toLowerCase() === name.trim().toLowerCase(),
  );
  if (exactMatch) {
    return { id: exactMatch.id };
  }

  const bestCandidate = candidates[0];
  if (bestCandidate) {
    return { id: bestCandidate.id };
  }

  const created = await client.createCustomer({ name, email });
  return { id: created.id };
}
