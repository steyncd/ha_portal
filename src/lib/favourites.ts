// Catalogue for the Overview "Favourites" quick-tile grid — the small set of
// one-tap actions the household actually reaches for (Apple/Google Home
// "Favorites" pattern). Which tiles show, and their order, is per-device in
// prefs.favourites; this is the master list they're chosen from.
import { E } from "./entities";

export type FavKind = "script" | "toggle" | "arm";
export type FavTile = {
  id: string;        // stable key stored in prefs.favourites
  label: string;
  icon: string;
  kind: FavKind;
  target: string;    // script/scene id, switch entity, or alarm entity
};

export const FAV_CATALOGUE: FavTile[] = [
  // Scenes / scripts (momentary)
  { id: "eveningin", label: "Evening In", icon: "🌆", kind: "script", target: E.scEveningIn },
  { id: "goodnight", label: "Goodnight", icon: "🌙", kind: "script", target: E.scGoodnight },
  { id: "movie", label: "Movie", icon: "🎬", kind: "script", target: E.scMovie },
  { id: "braai", label: "Braai", icon: "🔥", kind: "script", target: "script.braai_mode" },
  { id: "morning", label: "Morning", icon: "☀️", kind: "script", target: E.scMorning },
  { id: "away", label: "Away", icon: "🚪", kind: "script", target: E.scAway },
  { id: "lightsoff", label: "Lights off", icon: "💡", kind: "script", target: E.scLightsOff },
  // Security
  { id: "armaway", label: "Arm away", icon: "🛡️", kind: "arm", target: E.alarmHome },
  // Toggles (show live on/off)
  { id: "poolpump", label: "Pool Pump", icon: "🏊", kind: "toggle", target: E.poolPump },
  { id: "borehole", label: "Borehole", icon: "🕳️", kind: "toggle", target: E.boreholePump },
  { id: "heater", label: "Heater", icon: "🔥", kind: "toggle", target: E.heater },
  { id: "waterpump", label: "Water Pump", icon: "💧", kind: "toggle", target: E.waterPump },
  { id: "irrigate", label: "Irrigate", icon: "🌿", kind: "script", target: E.irrStartAll },
];

export const FAV_DEFAULTS = ["goodnight", "movie", "morning", "away", "lightsoff", "poolpump"];

export const favById = (id: string): FavTile | undefined => FAV_CATALOGUE.find((t) => t.id === id);
