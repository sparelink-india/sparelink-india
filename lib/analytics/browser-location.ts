/**
 * Browser-only location permission.
 *
 * WHY THIS IS A SEPARATE FILE
 *
 * `lib/analytics/location.ts` contains the SERVER half of location handling, and
 * it imports `lib/analytics/india-locations.ts`, which imports `lib/db`. That is
 * correct for a server module and fatal for a browser one: the bundler statically
 * follows a dynamic `import()` too, so a client component that lazily loaded
 * `requestPermission` from there pulled the whole Postgres driver into the
 * browser bundle and the build failed on `Can't resolve 'fs'`.
 *
 * Beyond the build failure, the important point is that the browser must never be
 * able to REACH `lib/db` at all. A single accidental import from a client
 * component would ship database code - and the connection string it reads - to
 * every visitor. Keeping the browser half in its own leaf module, with no imports
 * outside itself, makes that impossible by construction rather than by review.
 *
 * WHAT THIS MODULE DOES NOT DO
 *
 * It does not send anything anywhere. It returns the observed permission state and
 * the coordinates the browser reported, and it is the CALLER's job to decide what
 * to do with a denial and to submit a grant. Nothing is recorded implicitly by
 * asking.
 */

/**
 * Ask the browser for location permission.
 *
 * Only ever called from a UI that has just told the customer why. Returns the
 * observed permission state rather than coordinates to store, so a denial is a
 * normal outcome the caller can act on rather than an error.
 */
export async function requestPermission(): Promise<{
  state: "granted" | "denied" | "prompt" | "unsupported";
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
}> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return { state: "unsupported" };
  }
  return new Promise((resolve) => {
    let settled = false;
    // A geolocation prompt left unanswered must not hang the caller forever.
    // Fifteen seconds is long enough for a real decision and short enough that a
    // dismissed dialog cannot wedge a page.
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve({ state: "prompt" });
      }
    }, 15_000);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({
          state: "granted",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
        });
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ state: "denied" });
      },
      // `enableHighAccuracy: false` on purpose: a city-level fix is enough to tell
      // a customer which branch serves them, and asking for a precise fix would
      // make the permission prompt scarier than the feature deserves.
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 300_000 },
    );
  });
}
