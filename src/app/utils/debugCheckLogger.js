/**
 * Debug Check Logger
 * 
 * Shape Language: Input → Filter → Transform → Store → Output → Loop
 * - Input: Error events, check conditions
 * - Filter: Validate event structure, categorize by type
 * - Transform: Format event data, add metadata
 * - Store: (No persistence - console only)
 * - Output: Structured console logs with groups/tables
 * - Loop: Reusable across all error handling
 * 
 * A structured logger for "debugging is mostly check" systems.
 * Works in browser or Node. Uses console.* under the hood.
 */

/**
 * @typedef {'debug' | 'info' | 'warn' | 'error'} Severity
 */

/**
 * @typedef {'INVARIANT_VIOLATION' | 'CONTRACT_FAILURE' | 'DRIFT_FLAG' | 'TEST_FAILURE'} CheckCategory
 */

/**
 * @typedef {Object} DebugCheckEvent
 * @property {string} ts - ISO timestamp
 * @property {Severity} severity
 * @property {CheckCategory} category
 * @property {string} [invariantId] - e.g. "I-003"
 * @property {string} [contractId] - e.g. "C-014"
 * @property {string} [monitorId] - e.g. "M-002"
 * @property {string} [testId] - e.g. "T-101"
 * @property {string} message - Human-facing summary
 * @property {unknown} [expected] - Expected value/state
 * @property {unknown} [actual] - Actual value/state
 * @property {string} [system] - e.g. "HubSpot", "BillingService"
 * @property {string} [integration] - e.g. "StripeAdapter"
 * @property {string} [entityType] - e.g. "Deal", "Contact"
 * @property {string} [entityId] - e.g. "12345"
 * @property {string} [field] - e.g. "lifecyclestage"
 * @property {string} [operation] - e.g. "UPSERT", "TRANSFORM", "SYNC"
 * @property {string} [correlationId] - Same across a flow
 * @property {string} [runId] - One execution/run
 * @property {string[]} [trace] - Breadcrumb steps
 * @property {string} [nextCheck] - What to check next (turns logs into playbooks)
 */

/**
 * Get current ISO timestamp
 * @returns {string}
 */
function isoNow() {
  return new Date().toISOString();
}

/**
 * Format header for log output
 * @param {DebugCheckEvent} e
 * @returns {string}
 */
function formatHeader(e) {
  const id =
    e.invariantId ?? e.contractId ?? e.monitorId ?? e.testId ?? "UNSPECIFIED";
  return `[${e.category}] ${id} — ${e.message}`;
}

/**
 * Safely stringify unknown value
 * @param {unknown} x
 * @returns {string}
 */
function safeJson(x) {
  try {
    return JSON.stringify(x, null, 2);
  } catch {
    return String(x);
  }
}

/**
 * Emit formatted console output
 * @param {DebugCheckEvent} e
 */
function emitConsole(e) {
  const header = formatHeader(e);

  const level = e.severity;
  const fn =
    level === "error"
      ? console.error
      : level === "warn"
      ? console.warn
      : level === "info"
      ? console.info
      : console.debug;

  // Grouped output = fast scanning + expandable details
  console.groupCollapsed(header);

  fn(header);

  // A compact "context line" for quick scanning in logs
  const ctx = {
    ts: e.ts,
    severity: e.severity,
    system: e.system,
    integration: e.integration,
    entity: e.entityType && e.entityId ? `${e.entityType}:${e.entityId}` : undefined,
    field: e.field,
    operation: e.operation,
    correlationId: e.correlationId,
    runId: e.runId,
  };

  // Remove undefined keys (keeps tables clean)
  const ctxClean = Object.fromEntries(
    Object.entries(ctx).filter(([, v]) => v !== undefined)
  );

  if (Object.keys(ctxClean).length > 0) {
    console.table(ctxClean);
  }

  if (e.expected !== undefined || e.actual !== undefined) {
    console.log("expected:", e.expected);
    console.log("actual:  ", e.actual);
  }

  if (e.trace && e.trace.length > 0) {
    console.log("trace:", e.trace.join(" → "));
  }

  if (e.nextCheck) {
    console.log("nextCheck:", e.nextCheck);
  }

  // Single-line JSON for shipping to log collectors later
  console.log("eventJson:", safeJson(e));

  console.groupEnd();
}

/**
 * Log an invariant violation
 * @param {Omit<DebugCheckEvent, 'ts' | 'category' | 'severity'> & { severity?: Severity; invariantId: string }} args
 */
function logInvariantViolation(args) {
  emitConsole({
    ts: isoNow(),
    category: "INVARIANT_VIOLATION",
    severity: args.severity ?? "error",
    ...args,
  });
}

/**
 * Log a contract failure
 * @param {Omit<DebugCheckEvent, 'ts' | 'category' | 'severity'> & { severity?: Severity; contractId: string }} args
 */
function logContractFailure(args) {
  emitConsole({
    ts: isoNow(),
    category: "CONTRACT_FAILURE",
    severity: args.severity ?? "error",
    ...args,
  });
}

/**
 * Log a drift flag
 * @param {Omit<DebugCheckEvent, 'ts' | 'category' | 'severity'> & { severity?: Severity; monitorId: string }} args
 */
function logDriftFlag(args) {
  emitConsole({
    ts: isoNow(),
    category: "DRIFT_FLAG",
    severity: args.severity ?? "warn",
    ...args,
  });
}

/**
 * Log a test failure
 * @param {Omit<DebugCheckEvent, 'ts' | 'category' | 'severity'> & { severity?: Severity; testId: string }} args
 */
function logTestFailure(args) {
  emitConsole({
    ts: isoNow(),
    category: "TEST_FAILURE",
    severity: args.severity ?? "error",
    ...args,
  });
}

/**
 * Assert an invariant condition - logs and throws if condition is false
 * @param {unknown} condition
 * @param {Omit<DebugCheckEvent, 'ts' | 'category' | 'severity'> & { severity?: Severity; invariantId: string }} event
 * @throws {Error} If condition is false
 */
function assertInvariant(condition, event) {
  if (!condition) {
    logInvariantViolation(event);
    throw new Error(
      formatHeader({
        ts: isoNow(),
        category: "INVARIANT_VIOLATION",
        severity: "error",
        ...event,
      })
    );
  }
}

module.exports = {
  logInvariantViolation,
  logContractFailure,
  logDriftFlag,
  logTestFailure,
  assertInvariant,
};

