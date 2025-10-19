// src/lib/share.ts

// --- Simple base64url helpers for JSON payloads ---
function toBase64Url(json: string): string {
  // Encode UTF-8 safely, then base64url
  const utf8 = encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, p1) =>
    String.fromCharCode(parseInt(p1, 16))
  );
  return btoa(utf8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(b64u: string): string {
  const b64 = b64u.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const esc = Array.from(bin, (c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
  return decodeURIComponent(esc);
}

// What we store in the link 
export type SessionPayload = {
  v: 1;
  rounds: number;
  championIndex: number;
  scores: Record<number, number>; // { [bookIndex]: wins }
};

export function makeShareLink(payload: SessionPayload): string {
  const json = JSON.stringify(payload);
  const hash = "s=" + toBase64Url(json);
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#${hash}`;
}

export function parseShareLink(): SessionPayload | undefined {
  const m = window.location.hash.match(/[#&]s=([^&]+)/);
  if (!m) return;
  try {
    const json = fromBase64Url(m[1]);
    const parsed = JSON.parse(json) as SessionPayload;
    if (parsed && parsed.v === 1 && typeof parsed.rounds === "number") return parsed;
  } catch {
    /* ignore malformed */
  }
  return;
}
