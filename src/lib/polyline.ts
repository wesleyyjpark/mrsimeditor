export interface PolyPoint {
  x: number;
  y: number;
}

/** Waypoint with optional cubic Bezier handles (absolute meters). */
export interface BezierWaypoint extends PolyPoint {
  outX?: number;
  outY?: number;
  inX?: number;
  inY?: number;
}

export interface SampledPoint extends PolyPoint {
  /** Degrees, tangent along the path (0 = +X). */
  angle: number;
}

export type ConePathMode = "straight" | "curved";

function segmentLength(a: PolyPoint, b: PolyPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.hypot(dx, dy);
}

function segmentAngleDeg(a: PolyPoint, b: PolyPoint): number {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

function lerp(a: PolyPoint, b: PolyPoint, t: number): PolyPoint {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

function hasOut(p: BezierWaypoint): boolean {
  return typeof p.outX === "number" && typeof p.outY === "number";
}

function hasIn(p: BezierWaypoint): boolean {
  return typeof p.inX === "number" && typeof p.inY === "number";
}

/**
 * Sample points along a polyline at a fixed spacing.
 */
export function samplePolyline(points: PolyPoint[], spacingMeters: number): SampledPoint[] {
  if (!points.length) return [];
  if (points.length === 1) {
    return [{ x: points[0].x, y: points[0].y, angle: 0 }];
  }

  const spacing = Math.max(0.05, spacingMeters);
  const samples: SampledPoint[] = [];
  samples.push({
    x: points[0].x,
    y: points[0].y,
    angle: segmentAngleDeg(points[0], points[1]),
  });

  let remaining = spacing;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const len = segmentLength(a, b);
    if (len < 1e-9) continue;
    const angle = segmentAngleDeg(a, b);
    let traveled = 0;
    while (traveled + remaining <= len + 1e-9) {
      traveled += remaining;
      const t = traveled / len;
      samples.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        angle,
      });
      remaining = spacing;
    }
    remaining -= len - traveled;
  }

  const end = points[points.length - 1];
  const last = samples[samples.length - 1];
  const endDist = Math.hypot(end.x - last.x, end.y - last.y);
  if (endDist > spacing * 0.25) {
    const prev = points[points.length - 2];
    samples.push({
      x: end.x,
      y: end.y,
      angle: segmentAngleDeg(prev, end),
    });
  } else {
    last.x = end.x;
    last.y = end.y;
  }

  return samples;
}

export function polylineLength(points: PolyPoint[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    total += segmentLength(points[i], points[i + 1]);
  }
  return total;
}

function cubicBezier(p0: PolyPoint, p1: PolyPoint, p2: PolyPoint, p3: PolyPoint, t: number): PolyPoint {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;
  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  };
}

function densifyCubicBezier(
  p0: PolyPoint,
  p1: PolyPoint,
  p2: PolyPoint,
  p3: PolyPoint,
  steps: number
): PolyPoint[] {
  const out: PolyPoint[] = [];
  for (let i = 0; i <= steps; i += 1) {
    out.push(cubicBezier(p0, p1, p2, p3, i / steps));
  }
  return out;
}

/**
 * Default handles for one segment. bulgeFactor 0 = collinear (straight).
 */
export function defaultTwoPointHandles(
  a: PolyPoint,
  b: PolyPoint,
  bulgeFactor = 0.35
): { out: PolyPoint; in: PolyPoint } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = (-dy / len) * len * bulgeFactor;
  const py = (dx / len) * len * bulgeFactor;
  return {
    out: { x: a.x + dx / 3 + px, y: a.y + dy / 3 + py },
    in: { x: a.x + (2 * dx) / 3 + px, y: a.y + (2 * dy) / 3 + py },
  };
}

function segmentControls(
  a: BezierWaypoint,
  b: BezierWaypoint
): [PolyPoint, PolyPoint, PolyPoint, PolyPoint] {
  const c1 = hasOut(a)
    ? { x: a.outX as number, y: a.outY as number }
    : lerp(a, b, 1 / 3);
  const c2 = hasIn(b)
    ? { x: b.inX as number, y: b.inY as number }
    : lerp(a, b, 2 / 3);
  return [a, c1, c2, b];
}

/**
 * Set handles for a single segment without rewriting other segments.
 */
export function applySegmentHandles(
  points: BezierWaypoint[],
  segmentIndex: number,
  mode: ConePathMode,
  opts: { force?: boolean; bulgeFactor?: number } = {}
): void {
  if (segmentIndex < 0 || segmentIndex >= points.length - 1) return;
  const a = points[segmentIndex];
  const b = points[segmentIndex + 1];
  const bulge = mode === "straight" ? 0 : opts.bulgeFactor ?? 0.35;
  const need = opts.force || !hasOut(a) || !hasIn(b) || mode === "straight";
  if (!need && mode === "curved") return;
  const h = defaultTwoPointHandles(a, b, bulge);
  if (mode === "straight" || opts.force || !hasOut(a)) {
    a.outX = h.out.x;
    a.outY = h.out.y;
  }
  if (mode === "straight" || opts.force || !hasIn(b)) {
    b.inX = h.in.x;
    b.inY = h.in.y;
  }
}

/**
 * Ensure every segment has appropriate handles for its mode.
 * Existing curved handles are preserved unless force is set.
 */
export function ensureSegmentHandles(
  points: BezierWaypoint[],
  segmentModes: ConePathMode[],
  opts: { force?: boolean; bulgeFactor?: number } = {}
): BezierWaypoint[] {
  const out = points.map(cloneBezierWaypoint);
  if (out.length < 2) return out;
  for (let i = 0; i < out.length - 1; i += 1) {
    const mode = segmentModes[i] ?? "curved";
    applySegmentHandles(out, i, mode, opts);
  }
  return out;
}

/**
 * Normalize segmentModes to length points.length - 1.
 * Legacy: if only a global mode is known, fill all segments with it.
 */
export function normalizeSegmentModes(
  pointCount: number,
  segmentModes: ConePathMode[] | null | undefined,
  fallbackMode: ConePathMode = "curved"
): ConePathMode[] {
  const n = Math.max(0, pointCount - 1);
  if (n === 0) return [];
  const modes: ConePathMode[] = [];
  for (let i = 0; i < n; i += 1) {
    const m = segmentModes?.[i];
    modes.push(m === "straight" || m === "curved" ? m : fallbackMode);
  }
  return modes;
}

export function summarizePathMode(segmentModes: ConePathMode[]): ConePathMode | "mixed" {
  if (segmentModes.length === 0) return "curved";
  const first = segmentModes[0];
  return segmentModes.every((m) => m === first) ? first : "mixed";
}

/**
 * Densify a mixed straight/curved path into a polyline.
 */
export function densifyMixedPath(
  points: BezierWaypoint[],
  segmentModes: ConePathMode[],
  stepsPerSegment = 20
): PolyPoint[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [{ x: points[0].x, y: points[0].y }];

  const modes = normalizeSegmentModes(points.length, segmentModes);
  const withHandles = ensureSegmentHandles(points, modes);
  const dense: PolyPoint[] = [{ x: withHandles[0].x, y: withHandles[0].y }];

  for (let i = 0; i < withHandles.length - 1; i += 1) {
    const mode = modes[i] ?? "curved";
    const a = withHandles[i];
    const b = withHandles[i + 1];
    if (mode === "straight") {
      dense.push({ x: b.x, y: b.y });
    } else {
      const [p0, p1, p2, p3] = segmentControls(a, b);
      const seg = densifyCubicBezier(p0, p1, p2, p3, stepsPerSegment);
      seg.shift();
      dense.push(...seg);
    }
  }
  return dense;
}

/**
 * Sample cones along a mixed straight/curved path.
 */
export function sampleMixedPath(
  points: BezierWaypoint[],
  segmentModes: ConePathMode[],
  spacingMeters: number
): SampledPoint[] {
  if (points.length < 2) {
    return samplePolyline(points, spacingMeters);
  }
  const dense = densifyMixedPath(points, segmentModes, 24);
  return samplePolyline(dense, spacingMeters);
}

/** @deprecated Prefer sampleMixedPath — kept for callers that still pass a global mode. */
export function sampleSmoothPath(
  points: BezierWaypoint[],
  spacingMeters: number,
  mode: ConePathMode = "curved"
): SampledPoint[] {
  if (points.length < 2) return samplePolyline(points, spacingMeters);
  const modes = normalizeSegmentModes(points.length, null, mode);
  return sampleMixedPath(points, modes, spacingMeters);
}

/** @deprecated Prefer densifyMixedPath */
export function densifySmoothPath(
  points: BezierWaypoint[],
  stepsPerSegment = 20,
  mode: ConePathMode = "curved"
): PolyPoint[] {
  const modes = normalizeSegmentModes(points.length, null, mode);
  return densifyMixedPath(points, modes, stepsPerSegment);
}

/** @deprecated Prefer ensureSegmentHandles */
export function ensureBezierHandles(
  points: BezierWaypoint[],
  opts: { force?: boolean; mode?: ConePathMode; bulgeFactor?: number } = {}
): BezierWaypoint[] {
  const mode = opts.mode ?? "curved";
  const modes = normalizeSegmentModes(points.length, null, mode);
  return ensureSegmentHandles(points, modes, opts);
}

export function makeStraightHandles(points: BezierWaypoint[]): BezierWaypoint[] {
  const modes = normalizeSegmentModes(points.length, null, "straight");
  return ensureSegmentHandles(points, modes, { force: true });
}

export function applyBulgeFactor(points: BezierWaypoint[], bulgeFactor: number): BezierWaypoint[] {
  if (points.length < 2) return points.map(cloneBezierWaypoint);
  if (bulgeFactor <= 0) return makeStraightHandles(points);
  const modes = normalizeSegmentModes(points.length, null, "curved");
  return ensureSegmentHandles(points, modes, { force: true, bulgeFactor });
}

export function cloneBezierWaypoint(p: BezierWaypoint): BezierWaypoint {
  return {
    x: p.x,
    y: p.y,
    ...(typeof p.outX === "number" ? { outX: p.outX } : {}),
    ...(typeof p.outY === "number" ? { outY: p.outY } : {}),
    ...(typeof p.inX === "number" ? { inX: p.inX } : {}),
    ...(typeof p.inY === "number" ? { inY: p.inY } : {}),
  };
}
