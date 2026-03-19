export type CreateEmployeeTask = {
  kind: "create_employee";
  firstName: string;
  lastName: string;
  email?: string;
};

export type CreateCustomerTask = {
  kind: "create_customer";
  name: string;
  email?: string;
};

export type CreateInvoiceTask = {
  kind: "create_invoice";
  customerName: string;
  customerEmail?: string;
  description: string;
  amount: number;
  quantity: number;
  invoiceDate?: string;
  dueDate?: string;
};

export type UnknownTask = {
  kind: "unknown";
  reason: string;
};

export type ParsedTask = CreateEmployeeTask | CreateCustomerTask | CreateInvoiceTask | UnknownTask;

export type ExecutableTask = Exclude<ParsedTask, UnknownTask>;
