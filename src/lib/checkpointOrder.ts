/* Checkpoint Order Logic and everything that makes me want to die is here */

import { createUniqueId } from "../utils";

/** Vertical offset (m) for the half-plane sensor include inside a pole entity. */
export const POLE_SENSOR_Z_METERS = 1.5;

/**
 * Vertical offset (m) for half-plane on flags; matches `Transform z` in sim.
 */
export const FLAG_SENSOR_Z_METERS = 3;

/**
 * A pole passage checkpoint captures fabric angle and side at "Add" time so
 * multiple ordered passages through the same physical pole can each have a
 * distinct sensor orientation without duplicating the pole in the world.
 */
export type PolePassageCheckpoint = {
  kind: "polePassage";
  /** Stable id for sub-entity naming and list keys. */
  uid: string;
  objectId: string;
  entityName: string;
  /**
   * fabric.Object angle in degrees when the user clicked Add (read from canvas,
   * not React, so it stays in sync with the object after rotation).
   */
  angleDeg: number;
  /**
   * Track `globalRotation` in degrees at Add. Omitted in older saved entries;
   * export falls back to “same as current” so behavior matches legacy.
   */
  globalRotationAtAdd?: number;
  side: "left" | "right";
};

/**
 * Like {@link PolePassageCheckpoint} but for `passageTarget: "flag"` objects,
 * with an extra flip so a right/left pass can be approached from the opposite side.
 */
export type FlagPassageCheckpoint = {
  kind: "flagPassage";
  uid: string;
  objectId: string;
  entityName: string;
  angleDeg: number;
  globalRotationAtAdd?: number;
  side: "left" | "right";
  /** Adds 180° to the half-plane `Transform` so the pass works from the other approach. */
  facing: "front" | "back";
};

export type CheckpointOrderEntry = string | PolePassageCheckpoint | FlagPassageCheckpoint;

export function isPolePassageCheckpoint(
  e: CheckpointOrderEntry
): e is PolePassageCheckpoint {
  return typeof e === "object" && e !== null && (e as PolePassageCheckpoint).kind === "polePassage";
}

export function isFlagPassageCheckpoint(
  e: CheckpointOrderEntry
): e is FlagPassageCheckpoint {
  return typeof e === "object" && e !== null && (e as FlagPassageCheckpoint).kind === "flagPassage";
}

export function isAnyPassageCheckpoint(
  e: CheckpointOrderEntry
): e is PolePassageCheckpoint | FlagPassageCheckpoint {
  return isPolePassageCheckpoint(e) || isFlagPassageCheckpoint(e);
}

export function polePassageExportName(e: PolePassageCheckpoint): string {
  return `${e.entityName}_pass_${e.uid}`;
}

export function flagPassageExportName(e: FlagPassageCheckpoint): string {
  return `${e.entityName}_pass_${e.uid}`;
}

/** Keys for React lists — stable for structured entries, index-based for strings. */
export function checkpointKey(entry: CheckpointOrderEntry, index: number): string {
  if (isPolePassageCheckpoint(entry)) {
    return `pole-${entry.uid}`;
  }
  if (isFlagPassageCheckpoint(entry)) {
    return `flag-${entry.uid}`;
  }
  return `str-${index}-${String(entry).slice(0, 32)}`;
}

/**
 * Coerce legacy persisted state (string-only arrays) and validate objects.
 */
export function normalizeCheckpointOrder(raw: unknown): CheckpointOrderEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: CheckpointOrderEntry[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const t = item.trim();
      if (t) out.push(t);
    } else if (
      item &&
      typeof item === "object" &&
      (item as PolePassageCheckpoint).kind === "polePassage"
    ) {
      const p = item as Record<string, unknown>;
      const uid = typeof p.uid === "string" && p.uid ? p.uid : createUniqueId();
      const objectId = typeof p.objectId === "string" ? p.objectId : "";
      const entityName = typeof p.entityName === "string" ? p.entityName : "";
      const angleDeg = typeof p.angleDeg === "number" ? p.angleDeg : 0;
      const side = p.side === "left" || p.side === "right" ? p.side : "right";
      if (objectId && entityName) {
        const entry: PolePassageCheckpoint = {
          kind: "polePassage",
          uid,
          objectId,
          entityName,
          angleDeg,
          side,
        };
        if (typeof p.globalRotationAtAdd === "number")
          entry.globalRotationAtAdd = p.globalRotationAtAdd;
        out.push(entry);
      }
    } else if (
      item &&
      typeof item === "object" &&
      (item as FlagPassageCheckpoint).kind === "flagPassage"
    ) {
      const p = item as Record<string, unknown>;
      const uid = typeof p.uid === "string" && p.uid ? p.uid : createUniqueId();
      const objectId = typeof p.objectId === "string" ? p.objectId : "";
      const entityName = typeof p.entityName === "string" ? p.entityName : "";
      const angleDeg = typeof p.angleDeg === "number" ? p.angleDeg : 0;
      const side = p.side === "left" || p.side === "right" ? p.side : "right";
      const facing = p.facing === "back" ? "back" : "front";
      if (objectId && entityName) {
        const entry: FlagPassageCheckpoint = {
          kind: "flagPassage",
          uid,
          objectId,
          entityName,
          angleDeg,
          side,
          facing,
        };
        if (typeof p.globalRotationAtAdd === "number")
          entry.globalRotationAtAdd = p.globalRotationAtAdd;
        out.push(entry);
      }
    }
  }
  return out;
}

export function makePolePassageCheckpoint(
  input: Omit<PolePassageCheckpoint, "kind" | "uid"> & { uid?: string }
): PolePassageCheckpoint {
  return {
    kind: "polePassage",
    uid: input.uid && input.uid.length > 0 ? input.uid : createUniqueId(),
    objectId: input.objectId,
    entityName: input.entityName,
    angleDeg: input.angleDeg,
    ...(input.globalRotationAtAdd !== undefined
      ? { globalRotationAtAdd: input.globalRotationAtAdd }
      : {}),
    side: input.side,
  };
}

export function makeFlagPassageCheckpoint(
  input: Omit<FlagPassageCheckpoint, "kind" | "uid"> & { uid?: string }
): FlagPassageCheckpoint {
  return {
    kind: "flagPassage",
    uid: input.uid && input.uid.length > 0 ? input.uid : createUniqueId(),
    objectId: input.objectId,
    entityName: input.entityName,
    angleDeg: input.angleDeg,
    ...(input.globalRotationAtAdd !== undefined
      ? { globalRotationAtAdd: input.globalRotationAtAdd }
      : {}),
    side: input.side,
    facing: input.facing,
  };
}

export function formatCheckpointListLabel(entry: CheckpointOrderEntry): string {
  if (isPolePassageCheckpoint(entry)) {
    const side = entry.side === "left" ? "L" : "R";
    const ang = Math.round(entry.angleDeg * 10) / 10;
    return `${entry.entityName}  ${side}  ${ang}°`;
  }
  if (isFlagPassageCheckpoint(entry)) {
    const side = entry.side === "left" ? "L" : "R";
    const ap = entry.facing === "back" ? "B" : "F";
    const ang = Math.round(entry.angleDeg * 10) / 10;
    return `${entry.entityName}  ${side}  ${ap}  ${ang}°`;
  }
  return entry;
}

/**
 * Maps editor list entries to simulator checkpoint entity names in order.
 * Passage objects get unique `_pass_<uid>` names. Legacy plain entity
 * strings become `_pass_legacy_i` when no structured passages exist.
 */
export function resolveCheckpointExportNames(
  order: CheckpointOrderEntry[],
  getMeta: (
    entityName: string
  ) => { id: string; hasSensing: boolean; passageTarget: "pole" | "flag" } | undefined
): string[] {
  const poleById = new Map<string, PolePassageCheckpoint[]>();
  const flagById = new Map<string, FlagPassageCheckpoint[]>();
  for (const c of order) {
    if (isPolePassageCheckpoint(c)) {
      const arr = poleById.get(c.objectId) ?? [];
      arr.push(c);
      poleById.set(c.objectId, arr);
    } else if (isFlagPassageCheckpoint(c)) {
      const arr = flagById.get(c.objectId) ?? [];
      arr.push(c);
      flagById.set(c.objectId, arr);
    }
  }
  const legacyCount = new Map<string, number>();
  const stringOccurrence = new Map<string, number>();

  return order.map((item) => {
    if (isPolePassageCheckpoint(item)) {
      return polePassageExportName(item);
    }
    if (isFlagPassageCheckpoint(item)) {
      return flagPassageExportName(item);
    }
    const s = item.trim();
    const meta = getMeta(s);
    if (!meta?.hasSensing) return s;
    const struct =
      meta.passageTarget === "flag" ? flagById.get(meta.id) ?? [] : poleById.get(meta.id) ?? [];
    if (struct.length > 0) {
      const k = stringOccurrence.get(s) ?? 0;
      stringOccurrence.set(s, k + 1);
      const ref = struct[Math.min(k, struct.length - 1)];
      return isFlagPassageCheckpoint(ref) ? flagPassageExportName(ref) : polePassageExportName(ref);
    }
    const n = legacyCount.get(s) ?? 0;
    legacyCount.set(s, n + 1);
    return `${s}_pass_legacy_${n}`;
  });
}
