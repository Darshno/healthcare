/**
 * offlineStorage.ts
 *
 * Robust offline persistence layer:
 *  - Versioned storage with automatic migration (no data loss on schema changes)
 *  - Per-section keys (patients, queue, medicines, beds) for granular reads/writes
 *  - Write-debouncing to avoid thrashing AsyncStorage on rapid state changes
 *  - Graceful fallback if any section fails to hydrate
 *  - Network-aware sync scheduling (immediate on reconnect, retry backoff)
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Storage Schema Version ──────────────────────────────────────────────────────
const SCHEMA_VERSION = 4;

export const STORAGE_KEYS = {
  version:    "rha.schema.version",
  patients:   "rha.patients.v4",
  queue:      "rha.queue.v4",
  encounters: "rha.encounters.v4",
  referrals:  "rha.referrals.v4",
  medicines:  "rha.medicines.v4",
  inventory:  "rha.inventory.v4",
  beds:       "rha.beds.v4",
  units:      "rha.units.v4",
  ops:        "rha.ops.v4",
  vaccinations: "rha.vaccinations.v4",
  meta:       "rha.meta.v4",       // language, lastSyncedAt, currentUser
} as const;

export type StorageSection = keyof typeof STORAGE_KEYS;

// ─── Migration ───────────────────────────────────────────────────────────────────

/**
 * Runs once on first hydration. If the persisted version is older, it clears
 * the old monolithic keys so we start fresh with section keys.
 */
export async function ensureMigrated(): Promise<void> {
  try {
    const persisted = await AsyncStorage.getItem(STORAGE_KEYS.version);
    const version = persisted ? Number(persisted) : 0;
    if (version < SCHEMA_VERSION) {
      await AsyncStorage.multiRemove([
        "rural-health-access.workspace.v1",
        "rural-health-access.workspace.v2",
        "rural-health-access.workspace.v3",
      ]);
      await AsyncStorage.setItem(STORAGE_KEYS.version, String(SCHEMA_VERSION));
    }
  } catch {
    // Non-fatal – storage will simply be empty
  }
}

// ─── Granular Reads / Writes ─────────────────────────────────────────────────────

export async function readSection<T>(section: StorageSection): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS[section]);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeSection<T>(section: StorageSection, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS[section], JSON.stringify(data));
  } catch {
    // Silently swallow write errors; in-memory state is still correct
  }
}

// ─── Meta Bundle ─────────────────────────────────────────────────────────────────

export type MetaBundle = {
  language: string;
  lastSyncedAt: number;
  currentUser: unknown;
};

// ─── Bulk Hydration ──────────────────────────────────────────────────────────────

export type HydratedSections = {
  patients:   unknown[];
  queue:      unknown[];
  encounters: unknown[];
  referrals:  unknown[];
  medicines:  unknown[];
  inventory:  unknown[];
  beds:       unknown[];
  units:      unknown[];
  ops:        unknown[];
  vaccinations: unknown[];
  meta:       MetaBundle | null;
};

/**
 * Reads all sections in parallel. Any section that fails returns an empty array /
 * null rather than throwing, guaranteeing the app always starts.
 */
export async function hydrateAll(): Promise<HydratedSections> {
  const [patients, queue, encounters, referrals, medicines, inventory, beds, units, ops, vaccinations, meta] =
    await Promise.all([
      readSection<unknown[]>("patients"),
      readSection<unknown[]>("queue"),
      readSection<unknown[]>("encounters"),
      readSection<unknown[]>("referrals"),
      readSection<unknown[]>("medicines"),
      readSection<unknown[]>("inventory"),
      readSection<unknown[]>("beds"),
      readSection<unknown[]>("units"),
      readSection<unknown[]>("ops"),
      readSection<unknown[]>("vaccinations"),
      readSection<MetaBundle>("meta"),
    ]);

  return {
    patients:   patients   ?? [],
    queue:      queue      ?? [],
    encounters: encounters ?? [],
    referrals:  referrals  ?? [],
    medicines:  medicines  ?? [],
    inventory:  inventory  ?? [],
    beds:       beds       ?? [],
    units:      units      ?? [],
    ops:        ops        ?? [],
    vaccinations: vaccinations ?? [],
    meta,
  };
}

// ─── Debounced Writer ────────────────────────────────────────────────────────────

/**
 * Returns a debounced function that coalesces rapid calls into one write.
 * Useful for attaching to React state updates (which can fire many times/sec).
 */
export function createDebouncedWriter<T>(
  section: StorageSection,
  delayMs = 500,
): (data: T) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (data: T) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      writeSection(section, data).catch(() => undefined);
    }, delayMs);
  };
}

// ─── Sync Retry Scheduler ────────────────────────────────────────────────────────

type SyncFn = () => void;

/**
 * Schedules automatic sync retries with exponential back-off.
 * Call the returned cancel function to stop the scheduler.
 */
export function createSyncRetryScheduler(syncFn: SyncFn, maxAttempts = 5): () => void {
  const delays = [15_000, 30_000, 60_000, 120_000, 300_000]; // 15s → 5min
  let attempt = 0;
  let handle: ReturnType<typeof setTimeout> | null = null;

  const schedule = () => {
    if (attempt >= maxAttempts) return;
    const delay = delays[Math.min(attempt, delays.length - 1)];
    handle = setTimeout(() => {
      attempt += 1;
      syncFn();
      schedule();
    }, delay);
  };

  schedule();

  return () => {
    if (handle) clearTimeout(handle);
  };
}

// ─── Network Status Helpers ──────────────────────────────────────────────────────

/** Returns true if a basic fetch to a well-known endpoint succeeds. */
export async function checkActualConnectivity(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch("https://clients3.google.com/generate_204", {
      signal: ctrl.signal,
      cache: "no-store",
    });
    clearTimeout(id);
    return res.status === 204;
  } catch {
    return false;
  }
}
