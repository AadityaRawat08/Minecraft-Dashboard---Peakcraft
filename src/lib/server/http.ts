import { NextResponse } from "next/server";
import { ApiError } from "@/lib/server/auth";

export function ok<T>(data: T, init?: number) {
  return NextResponse.json(data, { status: init ?? 200 });
}

export function fail(status: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export async function handleApi(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) {
      return fail(err.status, err.message);
    }
    console.error("Unhandled API error:", err);
    return fail(500, "Something went wrong. Please try again.");
  }
}
