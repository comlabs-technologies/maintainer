import semver from "semver";
import type { ApiChange } from "@/lib/domain";
import { CATALOGUED_API_CHANGES } from "@/lib/providers/catalog";

export function coerceVersion(input: string | undefined | null): string | null {
  if (!input) return null;
  const cleaned = input.replace(/^[^\d]*/, "").trim();
  const coerced = semver.coerce(cleaned);
  return coerced ? coerced.version : null;
}

export function compareVersions(a: string, b: string): number {
  const left = coerceVersion(a);
  const right = coerceVersion(b);
  if (!left || !right) return 0;
  return semver.compare(left, right);
}

export function isNewerVersion(latest: string, current: string): boolean {
  return compareVersions(latest, current) > 0;
}

export function changeApplies(
  change: ApiChange,
  currentVersion: string,
): boolean {
  const current = coerceVersion(currentVersion);
  const from = coerceVersion(change.fromVersion);
  const to = coerceVersion(change.toVersion);
  if (!current || !from || !to) return false;
  return semver.gte(current, from) && semver.lt(current, to);
}

export function findApplicableChanges(
  providerId: string,
  currentVersion: string,
  catalog: ApiChange[] = CATALOGUED_API_CHANGES,
): ApiChange[] {
  return catalog.filter(
    (change) =>
      change.providerId === providerId && changeApplies(change, currentVersion),
  );
}

export function pickPrimaryChange(
  providerId: string,
  currentVersion: string,
  latestVersion: string,
  catalog: ApiChange[] = CATALOGUED_API_CHANGES,
): ApiChange | null {
  const applicable = findApplicableChanges(providerId, currentVersion, catalog);
  if (applicable.length === 0) return null;
  const matchingLatest = applicable.find(
    (change) => compareVersions(change.toVersion, latestVersion) <= 0,
  );
  return matchingLatest ?? applicable[applicable.length - 1] ?? null;
}
