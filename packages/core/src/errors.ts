export class WorkbenchError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class VaultPathError extends WorkbenchError {
  constructor(message: string, details?: unknown) {
    super(message, "VAULT_PATH_ERROR", details);
  }
}

export class PolicyViolationError extends WorkbenchError {
  constructor(message: string, details?: unknown) {
    super(message, "POLICY_VIOLATION", details);
  }
}

export class NoteValidationError extends WorkbenchError {
  constructor(message: string, details?: unknown) {
    super(message, "NOTE_VALIDATION_ERROR", details);
  }
}
