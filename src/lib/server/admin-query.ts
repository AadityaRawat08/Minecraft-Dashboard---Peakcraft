import "server-only";

// Shared query-parameter helpers for the /api/admin/* collection endpoints.
// Kept intentionally free of any database or HTTP imports so every admin route
// validates pagination/filter input exactly the same way.

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export type Pagination = { page: number; pageSize: number; offset: number };

/**
 * Parses and clamps `page` / `pageSize` query parameters. Invalid, negative or
 * absurd values are normalised instead of throwing so a malformed URL can never
 * cause a 500 from the API layer.
 */
export function parsePagination(searchParams: URLSearchParams): Pagination {
  const rawPage = Number(searchParams.get("page") ?? "1");
  const rawSize = Number(searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE));

  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const pageSize = Number.isFinite(rawSize) && rawSize >= 1
    ? Math.min(Math.floor(rawSize), MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE;

  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function totalPages(total: number, pageSize: number): number {
  if (pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Guards values that are handed to Postgres `uuid` columns. A non-UUID filter
 * would otherwise raise a database cast error (surfacing as a 500) rather than
 * a clean 400/no-results response.
 */
export function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Trims and length-caps free-text search input. */
export function parseSearch(searchParams: URLSearchParams, key = "q", maxLength = 100): string {
  const raw = searchParams.get(key);
  if (!raw) return "";
  return raw.trim().slice(0, maxLength);
}

/** Parses an optional date filter, returning null for missing/invalid input. */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Returns the value if it is one of the allowed enum members, otherwise null. */
export function parseEnum<T extends string>(value: string | null | undefined, allowed: readonly T[]): T | null {
  if (!value) return null;
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/** Coerces Postgres `count()`/`sum()` results (which arrive as strings) to numbers. */
export function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
