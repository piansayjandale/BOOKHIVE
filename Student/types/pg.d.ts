declare module "pg" {
  export interface QueryResult<R = Record<string, unknown>> {
    rows: R[];
    rowCount: number | null;
  }

  export class Pool {
    constructor(config?: {
      connectionString?: string;
      connectionTimeoutMillis?: number;
    });
    query<R = Record<string, unknown>>(
      text: string,
      values?: readonly unknown[],
    ): Promise<QueryResult<R>>;
  }

  const pg: {
    Pool: typeof Pool;
  };

  export default pg;
}
