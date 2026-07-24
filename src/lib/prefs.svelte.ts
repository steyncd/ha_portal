// Persisted per-user preferences + the selectable theme.

export type Theme = "aurora" | "tide" | "meadow" | "spectrum";

// Selectable themes (Steyn handoff). The gradient is only for the Settings/palette
// swatch preview; the live retint is driven by [data-theme] blocks in app.css.
export const THEMES: { key: Theme; name: string; grad: string }[] = [
  { key: "tide", name: "Tide", grad: "linear-gradient(135deg,#38bdf8,#818cf8)" },
  { key: "meadow", name: "Meadow", grad: "linear-gradient(135deg,#34d399,#38bdf8)" },
  { key: "spectrum", name: "Spectrum", grad: "linear-gradient(135deg,#38bdf8,#818cf8,#a855f7)" },
  { key: "aurora", name: "Classic", grad: "linear-gradient(135deg,#818cf8,#a855f7)" },
];

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
};

const DEFAULTS: Stored = {
  theme: "tide",
  motion: true,
  density: "comfortable",
  collapsed: false,
  guest: false,
  defaultView: "overview",
  settingsTab: "account",
  viewsOn: {
    energy: true, powertrends: true, solar: true, water: true, irrigation: true, climate: true, appliances: true,
    cameras: true, traffic: true, lights: true, reminders: true, system: true, control: true, me: true, vitality: true, timeline: true, insights: true, markets: true,
  },
  widgets: {
    scenes: true, lights: true, energyToday: true,
    security: true, activity: true, forecast: true,
  },
};

const isTheme = (t: unknown): t is Theme => t === "aurora" || t === "tide" || t === "meadow" || t === "spectrum";

function load(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const p = JSON.parse(raw);
    return {
      ...DEFAULTS, ...p,
      theme: isTheme(p.theme) ? p.theme : DEFAULTS.theme,
      density: p.density === "wall" ? "wall" : "comfortable",
      viewsOn: { ...DEFAULTS.viewsOn, ...(p.viewsOn ?? {}) },
      widgets: { ...DEFAULTS.widgets, ...(p.widgets ?? {}) },
    };
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
  }

  save() {
    const data: Stored = {
      theme: this.theme, motion: this.motion, density: this.density,
      collapsed: this.collapsed, guest: this.guest, defaultView: this.defaultView,
      settingsTab: this.settingsTab, viewsOn: this.viewsOn, widgets: this.widgets,
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
