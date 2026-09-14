// Transport layer — identical to the Team Builder's API_CONTRACT.md rules.
// GET for reads: fetch(url + '?token=…&action=…'). Apps Script answers with a 302 to
// script.googleusercontent.com; fetch follows it and the final response carries
// Access-Control-Allow-Origin: *. Never send credentials, never use application/json.

// Apps Script cold starts have been measured at ~40 s for `load`, so be patient.
const TIMEOUT_MS = 120000;

function cfg() {
  const c = (typeof window !== 'undefined' && window.TEAMFIT_CONFIG) || {};
  return { url: String(c.apiUrl || ''), token: String(c.token || '') };
}

export class ApiError extends Error {
  constructor(message, payload) { super(message); this.name = 'ApiError'; this.payload = payload || null; }
}

async function run(fetchPromise, action) {
  let res;
  try {
    res = await fetchPromise;
  } catch (err) {
    throw new ApiError(`Could not reach the Team Fit API (${action}): ${err && err.name === 'AbortError' ? 'no answer after 2 minutes' : (err && err.message) || err}`);
  }
  let json;
  try {
    json = await res.json();
  } catch (err) {
    throw new ApiError(`API returned a non-JSON response for ${action} (HTTP ${res.status}).`);
  }
  if (!json || typeof json !== 'object') throw new ApiError(`API returned an empty response for ${action}.`);
  if (json.ok === false) throw new ApiError(json.error || `API error during ${action}.`, json);
  return json;
}

function withTimeout(init) {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  if (ctl) { setTimeout(() => ctl.abort(), TIMEOUT_MS); init.signal = ctl.signal; }
  return init;
}

export function apiGet(action, params = {}) {
  const { url, token } = cfg();
  const qs = new URLSearchParams({ token, action, ...params });
  return run(fetch(`${url}?${qs}`, withTimeout({ method: 'GET' })), action);
}

/** The one call this site makes: the full roster snapshot (read-only). */
export function loadRoster() {
  return apiGet('load');
}
