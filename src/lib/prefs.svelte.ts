// Persisted per-user preferences + the selectable theme.

export type Theme =
  | "stone" | "basalt" | "fog"        // neutral
  | "slate" | "harbour" | "ink"       // cool
  | "clay" | "graphite" | "plum";     // warm

export type ThemeGroup = "Neutral" | "Cool" | "Warm";

// Selectable themes (v2). Each sets ONLY the neutral surface/text ramp — brand
// copper, status and domain colours are fixed in app.css and never themed, so
// switching theme can never change what a colour *means*.
// `grad` is the Settings swatch preview: bg → s1 → s2, i.e. the actual ramp.
export const THEMES: { key: Theme; name: string; group: ThemeGroup; desc: string; grad: string }[] = [
  // --- Neutral
  { key: "stone", name: "Stone", group: "Neutral", desc: "Warm-grey default, easiest on the eye",
    grad: "linear-gradient(135deg,#22252A,#2B2F35,#353A42)" },
  { key: "basalt", name: "Basalt", group: "Neutral", desc: "Darkest neutral, best in a dim room",
    grad: "linear-gradient(135deg,#17191D,#1F2227,#282C32)" },
  { key: "fog", name: "Fog", group: "Neutral", desc: "Lifted neutral, best in daylight",
    grad: "linear-gradient(135deg,#2A2E34,#343940,#3E444C)" },
  // --- Cool
  { key: "slate", name: "Slate", group: "Cool", desc: "Blue-grey, calm and technical",
    grad: "linear-gradient(135deg,#1B2027,#232A33,#2C343F)" },
  { key: "harbour", name: "Harbour", group: "Cool", desc: "Softer blue-grey, less contrast",
    grad: "linear-gradient(135deg,#1E242B,#262E37,#303A45)" },
  { key: "ink", name: "Ink", group: "Cool", desc: "Deep navy, strongest cool cast",
    grad: "linear-gradient(135deg,#141A24,#1C2431,#25303F)" },
  // --- Warm
  { key: "clay", name: "Clay", group: "Warm", desc: "Warm brown-grey, pairs with the copper",
    grad: "linear-gradient(135deg,#232120,#2C2927,#363230)" },
  { key: "graphite", name: "Graphite", group: "Warm", desc: "Warmest dark, almost sepia",
    grad: "linear-gradient(135deg,#1E1C1B,#272422,#322E2B)" },
  { key: "plum", name: "Plum", group: "Warm", desc: "Warm violet cast, softest of the nine",
    grad: "linear-gradient(135deg,#201C26,#292430,#332D3C)" },
];

export const THEME_GROUPS: ThemeGroup[] = ["Neutral", "Cool", "Warm"];

const KEY = "ha_portal_prefs";

type Density = "comfortable" | "wall";

type Stored = {
  theme: Theme;
  motion: boolean;
  density: Density;
  collapsed: boolean;
  guest: boolean;
  defaultView: string;
  settingsTab: string;
  viewsOn: Record<string, boolean>;
  widgets: Record<string, boolean>;
  favourites: string[];
  hiddenSuggestions: string[];
  homeSurfaceV1: boolean;
  trelloBoard: string;
  trelloLists: Record<string, boolean>;
};

const DEFAULTS: Stored = {
  theme: "stone",
  motion: true,
  density: "comfortable",
  collapsed: false,
  guest: false,
  defaultView: "home",
  settingsTab: "account",
  viewsOn: {
    energy: true, powertrends: true, solar: true, water: true, irrigation: true, climate: true, appliances: true,
    cameras: true, traffic: true, lights: true, reminders: true, trello: true, meals: true, fairplay: true, system: true, control: true, me: true, faith: true, kids: true, vitality: true, timeline: true, insights: true, usage: true, markets: true,
  },
  widgets: {
    scenes: true, lights: true, energyToday: true,
    security: true, activity: true, forecast: true,
  },
  favourites: ["goodnight", "movie", "morning", "away", "lightsoff", "poolpump"],
  hiddenSuggestions: [],
  homeSurfaceV1: false,
  trelloBoard: "",
  trelloLists: {},
};

const isTheme = (t: unknown): t is Theme => THEMES.some((x) => x.key === t);

function load(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const p = JSON.parse(raw);
    const merged = {
      ...DEFAULTS, ...p,
      theme: isTheme(p.theme) ? p.theme : DEFAULTS.theme,
      density: p.density === "wall" ? "wall" : "comfortable",
      viewsOn: { ...DEFAULTS.viewsOn, ...(p.viewsOn ?? {}) },
      widgets: { ...DEFAULTS.widgets, ...(p.widgets ?? {}) },
      favourites: Array.isArray(p.favourites) ? p.favourites : [...DEFAULTS.favourites],
      hiddenSuggestions: Array.isArray(p.hiddenSuggestions) ? p.hiddenSuggestions : [],
      homeSurfaceV1: p.homeSurfaceV1 === true,
      trelloBoard: typeof p.trelloBoard === "string" ? p.trelloBoard : "",
      trelloLists: { ...(p.trelloLists ?? {}) },
    };
    // One-time upgrade to the Home quick surface: existing users who never
    // changed their landing (still on the old "overview" default) are moved to
    // the new "home" front door once. Anyone can pick Dashboard again in Settings.
    if (!merged.homeSurfaceV1) {
      if (merged.defaultView === "overview") merged.defaultView = "home";
      merged.homeSurfaceV1 = true;
    }
    return merged;
  } catch {
    return structuredClone(DEFAULTS);
  }
}

class Prefs {
  theme = $state<Theme>(DEFAULTS.theme);
  motion = $state(DEFAULTS.motion);
  density = $state<Density>(DEFAULTS.density);
  collapsed = $state(DEFAULTS.collapsed);
  guest = $state(DEFAULTS.guest);
  defaultView = $state(DEFAULTS.defaultView);
  settingsTab = $state(DEFAULTS.settingsTab);
  viewsOn = $state<Record<string, boolean>>({ ...DEFAULTS.viewsOn });
  widgets = $state<Record<string, boolean>>({ ...DEFAULTS.widgets });
  favourites = $state<string[]>([...DEFAULTS.favourites]);
  hiddenSuggestions = $state<string[]>([]);
  homeSurfaceV1 = $state(false);
  trelloBoard = $state<string>("");
  trelloLists = $state<Record<string, boolean>>({});

  constructor() {
    const s = load();
    this.theme = s.theme;
    this.motion = s.motion;
    this.density = s.density;
    this.collapsed = s.collapsed;
    this.guest = s.guest;
    this.defaultView = s.defaultView;
    this.settingsTab = s.settingsTab;
    this.viewsOn = s.viewsOn;
    this.widgets = s.widgets;
    this.favourites = s.favourites;
    this.hiddenSuggestions = s.hiddenSuggestions;
    this.homeSurfaceV1 = s.homeSurfaceV1;
    this.trelloBoard = s.trelloBoard;
    this.trelloLists = s.trelloLists;
  }

  save() {
    const data: Stored = {
      theme: this.theme, motion: this.motion, density: this.density,
      collapsed: this.collapsed, guest: this.guest, defaultView: this.defaultView,
      settingsTab: this.settingsTab, viewsOn: this.viewsOn, widgets: this.widgets,
      favourites: this.favourites,
      hiddenSuggestions: this.hiddenSuggestions,
      homeSurfaceV1: this.homeSurfaceV1,
      trelloBoard: this.trelloBoard, trelloLists: this.trelloLists,
    };
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignore */ }
  }

  /** Apply theme + display flags to <html> (data-theme drives the CSS retint). */
  apply() {
    document.documentElement.dataset.theme = this.theme;
    document.documentElement.classList.toggle("reduce-motion", !this.motion);
    document.documentElement.classList.toggle("wall", this.density === "wall");
  }

  setTheme(t: Theme) { this.theme = t; this.apply(); this.save(); }

  resetWidgets() {
    this.widgets = { ...DEFAULTS.widgets };
    this.save();
  }
}

export const prefs = new Prefs();
