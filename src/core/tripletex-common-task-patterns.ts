export const COMMON_TASK_PATTERN_GUIDANCE = `
Use these common Tripletex planning patterns before exploring the full schema.

Pattern: create_single_entity
- Use when the user asks to create one standalone entity and all required values are already known.
- Default flow: one POST on the target resource.
- Examples:
  - "Create employee Ola Nordmann" -> POST /employee
  - "Create customer Acme AS" -> POST /customer
  - "Create project Northwind rollout" -> POST /project
- Rule: do not add lookup_requests unless a required nested object or ID must be resolved first.

Pattern: create_with_linking
- Use when the entity to create must reference an existing related object.
- Default flow: GET the related object once, then create the new object with the resolved ID.
- Examples:
  - "Create invoice for customer" -> GET /customer -> POST /order -> POST /invoice
  - "Create project for customer B" -> GET /customer -> POST /project
  - "Create travel expense for employee X" -> GET /employee -> POST /travelExpense
- Rule: prefer one lookup that resolves all required IDs, then perform the fewest mutations needed.

Pattern: modify_existing
- Use when the user wants to update or add data to an existing record.
- Default flow: resolve the target record only if its ID or current shape is unknown, then call the specific mutation endpoint.
- Example:
  - "Add phone to contact" -> GET target record -> PUT target resource
- Rule: only add a lookup when the target ID or current state is not already known from the user prompt.

Pattern: delete_or_reverse
- Use when the user wants to remove, reverse, or credit an existing object.
- Default flow: GET the target object to resolve its ID if needed, then call the delete or reversal mutation.
- Examples:
  - "Delete travel expense" -> GET /travelExpense -> DELETE target resource
  - "Credit invoice 123" -> GET /invoice -> schema fallback for reversal or credit-note flow
- Rule: choose the narrowest safe lookup and the most direct supported reversal path.

Pattern: multi_step_setup
- Use when the requested outcome depends on intermediate objects being created in sequence.
- Default flow: create or resolve prerequisites first, then the dependent object, then any final follow-up object.
- Examples:
  - "Register payment" -> create prerequisites -> create invoice -> schema fallback for payment step
  - "Invoice a customer for a new order" -> GET or POST /customer -> POST /order -> POST /invoice
  - "Book a supplier invoice with accounting effects" -> resolve supplier/account facts -> schema fallback for voucher or supplier-invoice flow
- Rule: break the task into the smallest valid chain of dependent requests.
- Rule: each step must either create an object needed by a later step or resolve an ID or fact required by a later mutation.
- Rule: if a later step can embed an earlier object directly according to schema, prefer the embedded flow over multiple separate requests.
`.trim();
