export interface AttemptRef {
  id: string;
  status: string;
}

interface IndexEntry {
  id: string;
  slug: string;
  updatedAt: number;
  status?: string;
}

const STORAGE_KEY = "lld_attempt_index";
const MAX_ENTRIES = 20;

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

/**
 * Raw index JSON for useSyncExternalStore snapshots. A string is
 * referentially stable by value, so no snapshot cache is needed — and no
 * cache means no stale cache, ever (cleared storage reads as empty).
 */
export function readAttemptIndexRaw(): string {
  if (typeof window === "undefined") return "[]";
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function parseIndex(raw: string): IndexEntry[] {
  try {
    const list: unknown = JSON.parse(raw);
    return Array.isArray(list)
      ? list.filter(
          (e): e is IndexEntry =>
            !!e &&
            typeof e === "object" &&
            typeof (e as IndexEntry).slug === "string" &&
            typeof (e as IndexEntry).id === "string"
        )
      : [];
  } catch {
    return [];
  }
}

/** Latest attempt for a slug (null on server / when absent / when corrupt). */
export function readAttemptForSlug(
  slug: string,
  raw: string = readAttemptIndexRaw()
): AttemptRef | null {
  const found = parseIndex(raw).find((e) => e.slug === slug);
  return found ? { id: found.id, status: found.status ?? "in_progress" } : null;
}

/** Record (or refresh) an attempt. Notifies same-tab subscribers too. */
export function touchAttempt(id: string, slug: string, status?: string): void {
  if (typeof window !== "undefined") {
    try {
      const rest = parseIndex(readAttemptIndexRaw()).filter((e) => e.id !== id);
      rest.unshift({
        id,
        slug,
        updatedAt: Date.now(),
        ...(status ? { status } : {})
      });
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rest.slice(0, MAX_ENTRIES)));
    } catch {
      /* private mode — subscribers still update */
    }
  }
  notify();
}

/** Subscribe to index changes (same-tab writes + cross-tab storage events). */
export function subscribeAttemptIndex(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = () => cb();
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(cb);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}
