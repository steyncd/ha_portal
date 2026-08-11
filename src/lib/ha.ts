import {
  getAuth,
  createLongLivedTokenAuth,
  createConnection,
  subscribeEntities,
  callService,
  ERR_HASS_HOST_REQUIRED,
  ERR_INVALID_AUTH,
  ERR_CANNOT_CONNECT,
  type Auth,
  type Connection,
  type HassEntities,
} from "home-assistant-js-websocket";
import { HASS_URL } from "./config";

const TOKEN_KEY = "ha_portal_tokens";

const saveTokens = (tokens: unknown) => {
  if (tokens) {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
};

const loadTokens = async () => {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Authenticate with Home Assistant and open a live WebSocket connection.
 *
 * On first run (no stored tokens) this redirects the browser to the HA login
 * page. When HA redirects back with `?auth_callback=1&code=...`, getAuth
 * exchanges the code for tokens and persists them to localStorage, so
 * subsequent loads connect silently.
 */
/** Wipe the saved OAuth tokens, so the next connect starts a fresh login. */
export function clearHaTokens(): void {
  saveTokens(null);
}

export async function connect(): Promise<{ auth: Auth; connection: Connection }> {
  let auth: Auth;
  try {
    auth = await getAuth({ hassUrl: HASS_URL, saveTokens, loadTokens });
  } catch (err) {
    if (err === ERR_HASS_HOST_REQUIRED) {
      throw new Error(
        "No Home Assistant URL configured. Set HASS_URL in src/lib/config.ts.",
      );
    }
    // ERR_INVALID_AUTH HERE, NOT JUST ON createConnection.
    //
    // getAuth REFRESHES the access token using the stored refresh token, so this
    // is the call that fails when that refresh token has been revoked — a token
    // deleted in HA's profile, a restore from backup, or a session cleared
    // server-side. It used to rethrow the raw error, which surfaced in the UI as
    // the bare number "2" (ERR_INVALID_AUTH is 2) AND left the dead tokens in
    // localStorage — so Retry re-read the same dead tokens and failed forever.
    // Nothing short of clearing site data could recover it.
    //
    // Clearing them and calling getAuth again means the second call finds no
    // tokens and redirects to the HA login page, which is the actual fix.
    if (err === ERR_INVALID_AUTH) {
      saveTokens(null);
      auth = await getAuth({ hassUrl: HASS_URL, saveTokens, loadTokens });
    } else {
      throw new Error(authErrorMessage(err));
    }
  }

  let connection: Connection;
  try {
    connection = await createConnection({ auth });
  } catch (err) {
    if (err === ERR_INVALID_AUTH) {
      // Stored tokens are stale — clear them and restart the login flow.
      saveTokens(null);
      auth = await getAuth({ hassUrl: HASS_URL, saveTokens, loadTokens });
      connection = await createConnection({ auth });
    } else if (err === ERR_CANNOT_CONNECT) {
      throw new Error(`Cannot reach Home Assistant at ${HASS_URL}.`);
    } else {
      throw new Error(authErrorMessage(err));
    }
  }

  // Strip the OAuth callback params from the address bar after login.
  if (location.search.includes("auth_callback")) {
    history.replaceState(null, "", location.pathname);
  }

  return { auth, connection };
}

/**
 * Connect to Home Assistant using a stored long-lived access token — no OAuth
 * redirect. Used when the portal has a saved HA connection (see haConfig.ts).
 * The token auth object is non-expiring, so refreshAccessToken is a no-op.
 */
export async function connectWithToken(
  url: string,
  token: string,
): Promise<{ auth: Auth; connection: Connection }> {
  const auth = createLongLivedTokenAuth(url, token);
  try {
    const connection = await createConnection({ auth });
    return { auth, connection };
  } catch (err) {
    if (err === ERR_INVALID_AUTH) {
      throw new Error("The stored Home Assistant token was rejected — update it in Settings.");
    }
    if (err === ERR_CANNOT_CONNECT) {
      throw new Error(`Cannot reach Home Assistant at ${url}.`);
    }
    throw err;
  }
}

/**
 * A sentence instead of a number.
 *
 * home-assistant-js-websocket rejects with integer constants, so any unwrapped
 * throw reaches the UI as "1".."5". A connection error screen that says "2" tells
 * you nothing and — worse — reads like a bug in the portal rather than a sign-in
 * that needs redoing.
 */
export function authErrorMessage(err: unknown): string {
  switch (err) {
    case ERR_CANNOT_CONNECT:
      return `Cannot reach Home Assistant at ${HASS_URL}. Check the house is online.`;
    case ERR_INVALID_AUTH:
      return "Home Assistant rejected the saved sign-in — the token was revoked or has expired. Sign in again.";
    case ERR_HASS_HOST_REQUIRED:
      return "No Home Assistant URL is configured.";
    case 3:
      return "The connection to Home Assistant was lost.";
    case 5:
      return "Home Assistant is on http:// but the portal is on https:// — the browser blocks that.";
    default:
      return err instanceof Error ? err.message : `Unexpected connection error (${String(err)}).`;
  }
}

export { subscribeEntities, callService };
export type { Connection, HassEntities };
