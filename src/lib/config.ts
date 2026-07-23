// Your Home Assistant URL. This is the direct endpoint (NGINX SSL proxy on the
// home network, TLS via Let's Encrypt), replacing the Nabu Casa relay for lower
// latency. Used as the OAuth host and the base for the portal's REST calls
// (conversation/template/calendars). The live connection normally uses the
// long-lived token stored in Settings → System (see haConfig.ts); this URL is
// the fallback OAuth host and REST base.
export const HASS_URL = "https://ha.helloliam.co.za";

// Entity domains we allow toggling by tapping a card.
export const TOGGLEABLE_DOMAINS = new Set([
  "light",
  "switch",
  "input_boolean",
  "fan",
]);
