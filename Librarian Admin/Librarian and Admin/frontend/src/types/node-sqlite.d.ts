declare module "node:sqlite" {
  export interface RunResult {
    changes: number;
    lastInsertRowid: number | bigint;
  }

  export class StatementSync {
    run(...params: unknown[]): RunResult;
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  }

  export class DatabaseSync {
    constructor(path: string);
    prepare(sql: string): StatementSync;
    exec(sql: string): void;
    close(): void;
  }
}

