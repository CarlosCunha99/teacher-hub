import { query } from "@/lib/db";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

interface AcceptanceRow {
  terms_version: string;
  accepted_at: string | Date;
}

export interface AcceptanceStatus {
  accepted: boolean;
  version?: string;
  acceptedAt?: string;
}

function toIsoString(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date(value).toISOString();
}

async function latestAcceptanceRow(teacherId: string): Promise<AcceptanceRow | null> {
  const { rows } = await query<AcceptanceRow>(
    `SELECT terms_version, accepted_at
     FROM terms_acceptances
     WHERE teacher_id = $1
     ORDER BY accepted_at DESC
     LIMIT 1`,
    [teacherId]
  );

  return rows[0] ?? null;
}

export async function hasAcceptedCurrentTerms(teacherId: string): Promise<boolean> {
  const row = await latestAcceptanceRow(teacherId);
  return row?.terms_version === CURRENT_TERMS_VERSION;
}

export async function getAcceptanceStatus(teacherId: string): Promise<AcceptanceStatus> {
  const row = await latestAcceptanceRow(teacherId);

  if (row?.terms_version === CURRENT_TERMS_VERSION) {
    return {
      accepted: true,
      version: CURRENT_TERMS_VERSION,
      acceptedAt: toIsoString(row.accepted_at),
    };
  }

  return { accepted: false };
}

export async function recordAcceptance(
  teacherId: string,
  version: string
): Promise<{ acceptedAt: string }> {
  try {
    const { rows } = await query<{ accepted_at: string | Date }>(
      `INSERT INTO terms_acceptances (teacher_id, terms_version)
       VALUES ($1, $2)
       RETURNING accepted_at`,
      [teacherId, version]
    );

    return { acceptedAt: toIsoString(rows[0].accepted_at) };
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return { acceptedAt: new Date().toISOString() };
    }

    throw error;
  }
}
