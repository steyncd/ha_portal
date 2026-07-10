// Your Home Assistant URL. This is your Nabu Casa remote URL, which works
// from anywhere and already handles TLS + auth routing.
//
// For local development against a LAN instance you could point this at
// http://homeassistant.local:8123, but the Nabu Casa URL works everywhere.
export const HASS_URL = "https://srdjxebb2syncv7w776989z0fgjo9324.ui.nabu.casa";

// Entity domains we allow toggling by tapping a card.
export const TOGGLEABLE_DOMAINS = new Set([
  "light",
  "switch",
  "input_boolean",
  "fan",
]);
