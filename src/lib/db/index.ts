export interface DbClient {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export const NOT_IMPLEMENTED_ERROR = new Error(
  "Database client is not implemented yet. Complete issue #3 prerequisites."
);

const db: DbClient = {
  async query() {
    throw NOT_IMPLEMENTED_ERROR;
  },
};

export default db;
