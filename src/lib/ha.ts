import {
  getAuth,
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

export { subscribeEntities, callService };
export type { Connection, HassEntities };
