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
    throw err;
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
      throw err;
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

export { subscribeEntities, callService };
export type { Connection, HassEntities };
