/**
 * Utilities
 * Shared pure helpers for IDs, color math, angles, XML comments, and transforms.
 */
(() => {
  function createUniqueId() {
    if (typeof window !== "undefined" && window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    return `obj-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  }

  function hexToRgba(hex, alpha) {
    const sanitized = hex.replace("#", "");
    const bigint = parseInt(sanitized, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function normalizeAngle(angleDegrees) {
    let angle = angleDegrees % 360;
    if (angle < 0) {
      angle += 360;
    }
    return angle;
  }

  function normalizeEditorAngle(angleDegrees) {
    let angle = angleDegrees % 360;
    if (angle < -180) {
      angle += 360;
    }
    if (angle > 180) {
      angle -= 360;
    }
    return angle;
  }

  function downloadText(text, filename) {
    const blob = new Blob([text], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function buildEditorMeta(meta) {
    return `      <!-- EditorMeta: ${JSON.stringify(meta)} -->`;
  }

  function parseEditorMeta(commentText) {
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

  function invertGlobalTransform(finalX, finalY, globalOffsetX, globalOffsetY, globalRotationDegrees) {
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

  if (typeof window !== "undefined") {
    window.Utils = {
      createUniqueId,
      hexToRgba,
      normalizeAngle,
      normalizeEditorAngle,
      downloadText,
      buildEditorMeta,
      parseEditorMeta,
      invertGlobalTransform,
    };
  }
})();
