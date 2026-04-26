export function createUniqueId(): string {
  if (typeof window !== "undefined" && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `obj-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export function hexToRgba(hex: string, alpha: number): string {
  const sanitized = hex.replace("#", "");
  const bigint = parseInt(sanitized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function normalizeAngle(angleDegrees: number): number {
  let angle = angleDegrees % 360;
  if (angle < 0) {
    angle += 360;
  }
  return angle;
}

export function normalizeEditorAngle(angleDegrees: number): number {
  let angle = angleDegrees % 360;
  if (angle < -180) {
    angle += 360;
  }
  if (angle > 180) {
    angle -= 360;
  }
  return angle;
}

export function downloadText(text: string, filename: string): void {
  const blob = new Blob([text], { type: "application/xml" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function buildEditorMeta(meta: Record<string, unknown>): string {
  return `      <!-- EditorMeta: ${JSON.stringify(meta)} -->`;
}

export function parseEditorMeta(commentText: string | null | undefined): Record<string, unknown> | null {
  if (!commentText) {
    return null;
  }
  const marker = "EditorMeta:";
  const index = commentText.indexOf(marker);
  if (index === -1) {
    return null;
  }
  const jsonText = commentText.slice(index + marker.length).trim();
  if (!jsonText) {
    return null;
  }
  try {
    return JSON.parse(jsonText);
  } catch (error) {
    console.warn("Failed to parse EditorMeta comment", error);
    return null;
  }
}

export function invertGlobalTransform(
  finalX: number,
  finalY: number,
  globalOffsetX: number,
  globalOffsetY: number,
  globalRotationDegrees: number
): { forward: number; lateral: number } {
  const rotationRad = (globalRotationDegrees * Math.PI) / 180;
  const cosR = Math.cos(rotationRad);
  const sinR = Math.sin(rotationRad);
  const adjustedX = finalX - globalOffsetX;
  const adjustedY = finalY - globalOffsetY;
  const rotatedForward = adjustedX;
  const rotatedLateral = -adjustedY;
  const forward = rotatedForward * cosR + rotatedLateral * sinR;
  const lateral = -rotatedForward * sinR + rotatedLateral * cosR;
  return { forward, lateral };
}
