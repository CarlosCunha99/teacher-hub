import { NextResponse } from "next/server";
import { getTaxonomy } from "@/lib/taxonomy-service";

export async function GET(_request: Request): Promise<Response> {
  const { subjects, yearLevels } = getTaxonomy();
  return NextResponse.json({ subjects, yearLevels }, { status: 200 });
}
