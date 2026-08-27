import { Pool } from "pg";

export interface QueryResult<T> {
  rows: T[];
}

let pool: Pool | undefined;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }

  return pool;
}

export async function query<T = unknown>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  const result = await getPool().query(text, params);
  return { rows: result.rows as T[] };
}
