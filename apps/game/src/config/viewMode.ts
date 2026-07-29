export type ViewMode = "stream" | "operator";

/**
 * `?view=stream` renders the compact capture surface below the camera for OBS
 * or TikTok LIVE
 * Studio. Anything else falls back to the local operator workspace.
 */
export function resolveViewMode(search = globalThis.location?.search ?? ""): ViewMode {
  const params = new URLSearchParams(search);
  return params.get("view") === "stream" ? "stream" : "operator";
}

/** `?autostart=1` starts the round without a click (useful in OBS). */
export function shouldAutoStart(
  search = globalThis.location?.search ?? "",
): boolean {
  const params = new URLSearchParams(search);
  const value = params.get("autostart");
  return value === "1" || value === "true";
}

export const SUPPORT_URL =
  "https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=swoellner.pay@gmx.de&currency_code=EUR&item_name=NOEMA+Live+Games";
