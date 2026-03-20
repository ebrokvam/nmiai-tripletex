import type { PlannedRequest } from "../types/task-plan.js";

export const COMMON_LOOKUP_REQUEST_TEMPLATES: PlannedRequest[] = [
  {
    method: "GET",
    path: "/employee",
    purpose: "Find employees by identifying fields before payroll, project, travel expense, or assignment mutations.",
    query_json: '{"count":"20","fields":"id"}',
    body_json: null,
    format_requirements: [
      "Add only the filters needed for the task, typically one or more of: id, firstName, lastName, employeeNumber, email, departmentId.",
      "Keep fields minimal. Request only the fields needed by later steps, often just id.",
      "Query values must be strings when sent to the Tripletex MCP tool.",
      "Prefer this lookup only when an employee ID or employee facts are required before a mutation.",
    ],
  },
  {
    method: "GET",
    path: "/customer",
    purpose: "Find customers by org number, name, account number, or email before invoice, order, or project mutations.",
    query_json: '{"count":"20","fields":"id"}',
    body_json: null,
    format_requirements: [
      "Add only the filters needed for the task, typically one or more of: id, organizationNumber, customerName, customerAccountNumber, email, invoiceEmail.",
      "Keep fields minimal. Request only the fields needed by later steps, often just id.",
      "Query values must be strings when sent to the Tripletex MCP tool.",
      "Use a single customer lookup when it can resolve all needed customer identifiers for later mutations.",
    ],
  },
  {
    method: "GET",
    path: "/product",
    purpose: "Find products by number, name, supplier, account, or VAT-related fields before invoice or order mutations.",
    query_json: '{"count":"20","fields":"id"}',
    body_json: null,
    format_requirements: [
      "Add only the filters needed for the task, typically one or more of: number, productNumber, name, supplierId, vatTypeId, accountId, departmentId.",
      "Keep fields minimal. Request only the fields needed by later steps, often just id.",
      "Query values must be strings when sent to the Tripletex MCP tool.",
      "Use this only when a product ID or product facts are required before a mutation.",
    ],
  },
  {
    method: "GET",
    path: "/invoice",
    purpose: "Find charged outgoing invoices by invoice number, customer, voucher, or date window.",
    query_json:
      '{"invoiceDateFrom":"<YYYY-MM-DD>","invoiceDateTo":"<YYYY-MM-DD>","count":"20","fields":"id"}',
    body_json: null,
    format_requirements: [
      "invoiceDateFrom and invoiceDateTo are required by the schema for /invoice GET.",
      "Keep fields minimal. Request only the fields needed by later steps. Add amount or customer fields only if the payment or follow-up flow requires them.",
      "Add optional filters only when needed, such as id, invoiceNumber, voucherId, customerId, or kid.",
      "Query values must be strings when sent to the Tripletex MCP tool.",
    ],
  },
  {
    method: "GET",
    path: "/order",
    purpose: "Find orders by order number, customer, or date window before invoicing or update flows.",
    query_json:
      '{"orderDateFrom":"<YYYY-MM-DD>","orderDateTo":"<YYYY-MM-DD>","count":"20","fields":"id"}',
    body_json: null,
    format_requirements: [
      "orderDateFrom and orderDateTo are required by the schema for /order GET.",
      "Keep fields minimal. Request only the fields needed by later steps, often just id.",
      "Add optional filters only when needed, such as id, number, customerId, deliveryComment, isClosed, or isSubscription.",
      "Query values must be strings when sent to the Tripletex MCP tool.",
    ],
  },
  {
    method: "GET",
    path: "/travelExpense",
    purpose: "Find travel expenses by employee, project, department, date range, or state before reimbursement or review flows.",
    query_json: '{"count":"20","fields":"id"}',
    body_json: null,
    format_requirements: [
      "Add only the filters needed for the task, typically one or more of: employeeId, projectId, departmentId, departureDateFrom, returnDateTo, state.",
      "Keep fields minimal. Request only the fields needed by later steps, often just id or state.",
      "Query values must be strings when sent to the Tripletex MCP tool.",
      "Use this only when travel expense identifiers or state are required before a later action.",
    ],
  },
  {
    method: "GET",
    path: "/project",
    purpose: "Find projects by id, name, number, customer, department, or manager before time, invoice, or project mutations.",
    query_json: '{"count":"20","fields":"id"}',
    body_json: null,
    format_requirements: [
      "Add only the filters needed for the task, typically one or more of: id, name, number, customerId, projectManagerId, departmentId, isClosed.",
      "Keep fields minimal. Request only the fields needed by later steps, often just id.",
      "Query values must be strings when sent to the Tripletex MCP tool.",
      "Prefer one project lookup that resolves all required identifiers for downstream mutations.",
    ],
  },
  {
    method: "GET",
    path: "/department",
    purpose: "Find departments by id, name, number, or manager before employee, project, or account mutations.",
    query_json: '{"count":"20","fields":"id"}',
    body_json: null,
    format_requirements: [
      "Add only the filters needed for the task, typically one or more of: id, name, departmentNumber, departmentManagerId.",
      "Keep fields minimal. Request only the fields needed by later steps, often just id.",
      "Query values must be strings when sent to the Tripletex MCP tool.",
    ],
  },
  {
    method: "GET",
    path: "/ledger/account",
    purpose: "Find chart-of-account entries by account number, id, ledger type, or supplier-invoice applicability.",
    query_json: '{"count":"20","fields":"id"}',
    body_json: null,
    format_requirements: [
      "Add only the filters needed for the task, typically one or more of: id, number, ledgerType, isApplicableForSupplierInvoice, isBankAccount, isInactive.",
      "Keep fields minimal. Request only the fields needed by later steps, often just id.",
      "Query values must be strings when sent to the Tripletex MCP tool.",
      "Use this before supplier-invoice or voucher mutations only when an account ID must be resolved.",
    ],
  },
  {
    method: "GET",
    path: "/ledger/posting",
    purpose: "Find ledger postings by required date range and optional account, supplier, customer, employee, project, or posting type filters.",
    query_json:
      '{"dateFrom":"<YYYY-MM-DD>","dateTo":"<YYYY-MM-DD>","count":"20","fields":"id"}',
    body_json: null,
    format_requirements: [
      "dateFrom and dateTo are required by the schema for /ledger/posting GET.",
      "Keep fields minimal. Request only the fields needed by later steps. Add amount, account, or voucher fields only if the follow-up flow requires them.",
      "Add optional filters only when needed, such as accountId, supplierId, customerId, employeeId, departmentId, projectId, productId, type, or openPostings.",
      "Query values must be strings when sent to the Tripletex MCP tool.",
    ],
  },
  {
    method: "GET",
    path: "/ledger/voucher",
    purpose: "Find vouchers by number, id, voucher type, or required date range before reversals, deletions, or follow-up bookkeeping.",
    query_json:
      '{"dateFrom":"<YYYY-MM-DD>","dateTo":"<YYYY-MM-DD>","count":"20","fields":"id"}',
    body_json: null,
    format_requirements: [
      "dateFrom and dateTo are required by the schema for /ledger/voucher GET.",
      "Keep fields minimal. Request only the fields needed by later steps, often just id.",
      "Add optional filters only when needed, such as id, number, numberFrom, numberTo, or typeId.",
      "Query values must be strings when sent to the Tripletex MCP tool.",
    ],
  },
];

export const COMMON_MUTATION_REQUEST_TEMPLATES: PlannedRequest[] = [
  {
    method: "POST",
    path: "/employee",
    purpose: "Create a new employee record.",
    query_json: null,
    body_json:
      '{"firstName":"<first_name>","lastName":"<last_name>","email":"<email_optional>","employeeNumber":"<employee_number_optional>"}',
    format_requirements: [
      "Body shape follows the Employee schema in OpenAPI.",
      "Use only fields supported by the schema and omit unknown placeholders that are not needed.",
      "If department, category, employment, or user-type objects are needed, resolve IDs first and send nested objects in the schema-compatible shape.",
    ],
  },
  {
    method: "POST",
    path: "/customer",
    purpose: "Create a new customer, optionally with related addresses.",
    query_json: null,
    body_json:
      '{"name":"<customer_name>","organizationNumber":"<org_number_optional>","email":"<email_optional>","invoiceEmail":"<invoice_email_optional>"}',
    format_requirements: [
      "Body shape follows the Customer schema in OpenAPI.",
      "Use nested address, currency, department, ledger account, or account manager objects only when needed and only in schema-compatible shape.",
      "Prefer the minimal body needed to create the customer successfully.",
    ],
  },
  {
    method: "POST",
    path: "/product",
    purpose: "Create a new product or service.",
    query_json: null,
    body_json:
      '{"name":"<product_name>","number":"<product_number_optional>","priceExcludingVatCurrency":"<price_ex_vat_optional>"}',
    format_requirements: [
      "Body shape follows the Product schema in OpenAPI.",
      "If account, department, vatType, currency, productUnit, or supplier objects are needed, resolve IDs first and send nested objects in schema-compatible shape.",
      "Prefer the minimal body needed for the requested product setup.",
    ],
  },
  {
    method: "POST",
    path: "/invoice",
    purpose: "Create an outgoing invoice, optionally creating or embedding related orders and order lines.",
    query_json: '{"sendToCustomer":"false"}',
    body_json:
      '{"customer":{"id":"<customer_id>"},"invoiceDate":"<YYYY-MM-DD>","orderLines":[{"description":"<line_description>","count":"<quantity>","priceExcludingVatCurrency":"<unit_price_ex_vat>"}]}',
    format_requirements: [
      "Body shape follows the Invoice schema in OpenAPI.",
      "customer.id is typically required for direct invoice creation unless the schema supports another embedded flow.",
      "Add optional query parameters such as paymentTypeId or paidAmount only when the task explicitly requires them.",
      "If creating an order first is the simpler supported flow, prefer POST /order followed by POST /invoice.",
    ],
  },
  {
    method: "POST",
    path: "/order",
    purpose: "Create a new order that can later be invoiced.",
    query_json: null,
    body_json:
      '{"customer":{"id":"<customer_id>"},"orderDate":"<YYYY-MM-DD>","orderLines":[{"description":"<line_description>","count":"<quantity>","priceExcludingVatCurrency":"<unit_price_ex_vat>"}]}',
    format_requirements: [
      "Body shape follows the Order schema in OpenAPI.",
      "Use nested customer, project, department, contact, or orderLines objects only when needed and only in schema-compatible shape.",
      "Prefer POST /order as the default linking step before POST /invoice when the task is to invoice a customer for goods or services.",
    ],
  },
  {
    method: "POST",
    path: "/travelExpense",
    purpose: "Create a travel expense report.",
    query_json: null,
    body_json:
      '{"employee":{"id":"<employee_id>"},"date":"<YYYY-MM-DD>","title":"<travel_title>"}',
    format_requirements: [
      "Body shape follows the TravelExpense schema in OpenAPI.",
      "If project, department, costs, mileage allowances, per-diem compensations, or VAT objects are needed, resolve IDs first and send nested objects in schema-compatible shape.",
      "Prefer the minimal body needed for the requested expense flow.",
    ],
  },
  {
    method: "POST",
    path: "/project",
    purpose: "Create a new project.",
    query_json: null,
    body_json:
      '{"name":"<project_name>","customer":{"id":"<customer_id_optional>"},"startDate":"<YYYY-MM-DD_optional>"}',
    format_requirements: [
      "Body shape follows the Project schema in OpenAPI.",
      "If customer, department, projectManager, category, vatType, or participant objects are needed, resolve IDs first and send nested objects in schema-compatible shape.",
      "Prefer the minimal body needed for the requested project setup.",
    ],
  },
  {
    method: "POST",
    path: "/department",
    purpose: "Create a new department.",
    query_json: null,
    body_json:
      '{"name":"<department_name>","departmentNumber":"<department_number_optional>"}',
    format_requirements: [
      "Body shape follows the Department schema in OpenAPI.",
      "If a department manager must be attached, resolve the employee ID first and send the nested manager object in schema-compatible shape.",
    ],
  },
  {
    method: "POST",
    path: "/ledger/account",
    purpose: "Create a new account in the chart of accounts.",
    query_json: null,
    body_json:
      '{"number":"<account_number>","name":"<account_name>","ledgerType":"<ledger_type>"}',
    format_requirements: [
      "Body shape follows the Account schema in OpenAPI.",
      "If currency, department, balance group, vatType, or account-type objects are needed, resolve IDs first and send nested objects in schema-compatible shape.",
      "Use only legal ledgerType and other enum-like values permitted by the schema.",
    ],
  },
  {
    method: "POST",
    path: "/ledger/voucher",
    purpose: "Create a voucher with postings.",
    query_json: '{"sendToLedger":"true"}',
    body_json:
      '{"date":"<YYYY-MM-DD>","description":"<voucher_description>","postings":[{"account":{"id":"<account_id>"},"amount":"<gross_amount>"}]}',
    format_requirements: [
      "Body shape follows the Voucher schema in OpenAPI.",
      "A voucher must include schema-compatible postings; resolve account and other referenced IDs before mutation.",
      "Amounts should be rounded to 2 decimals, matching the OpenAPI summary for /ledger/voucher POST.",
    ],
  },
];

export function buildCommonRequestTemplateCatalog(): {
  lookup_requests: PlannedRequest[];
  mutation_requests: PlannedRequest[];
} {
  return {
    lookup_requests: COMMON_LOOKUP_REQUEST_TEMPLATES,
    mutation_requests: COMMON_MUTATION_REQUEST_TEMPLATES,
  };
}
