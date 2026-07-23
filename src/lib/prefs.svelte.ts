// Persisted per-user preferences + the derived "Aurora Command" theme.

export type PaletteId = "ti" | "3b" | "3c" | "3a" | "3d" | "3e";

// The 6 palettes from the Aurora Command handoff. A theme = --base/--acc/--acc2;
// --grad/--wash/--wash2 derive from the accents.
export const PALETTES: { id: PaletteId; name: string; base: string; acc: string; acc2: string }[] = [
  { id: "ti", name: "Teal · Indigo", base: "#13171a", acc: "#2dd4bf", acc2: "#818cf8" },
  { id: "3b", name: "Indigo Nightfall", base: "#0f1422", acc: "#818cf8", acc2: "#6366f1" },
  { id: "3c", name: "Teal Graphite", base: "#13171a", acc: "#2dd4bf", acc2: "#22d3ee" },
  { id: "3a", name: "Aurora Violet", base: "#15171f", acc: "#a78bfa", acc2: "#818cf8" },
  { id: "3d", name: "Rose Charcoal", base: "#181317", acc: "#fb7185", acc2: "#f472b6" },
  { id: "3e", name: "Slate Mono", base: "#101216", acc: "#a3b2c7", acc2: "#cbd5e1" },
];

const KEY = "ha_portal_prefs";

type Density = "comfortable" | "wall";

type Stored = {
  palette: PaletteId;
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
  palette: "ti",
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

function load(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const p = JSON.parse(raw);
    const palette: PaletteId = PALETTES.some((x) => x.id === p.palette) ? p.palette : DEFAULTS.palette;
    const density: Density = p.density === "wall" ? "wall" : "comfortable";
    return {
      ...DEFAULTS, ...p, palette, density,
      viewsOn: { ...DEFAULTS.viewsOn, ...(p.viewsOn ?? {}) },
      widgets: { ...DEFAULTS.widgets, ...(p.widgets ?? {}) },
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

class Prefs {
  palette = $state<PaletteId>(DEFAULTS.palette);
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
    this.palette = s.palette;
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
      palette: this.palette, motion: this.motion, density: this.density,
      collapsed: this.collapsed, guest: this.guest, defaultView: this.defaultView,
      settingsTab: this.settingsTab, viewsOn: this.viewsOn, widgets: this.widgets,
    };
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignore */ }
  }

  /** The active palette record. */
  get theme() {
    return PALETTES.find((p) => p.id === this.palette) ?? PALETTES[0];
  }
  get acc() { return this.theme.acc; }
  get acc2() { return this.theme.acc2; }

  /** Apply the theme + display flags to :root as CSS custom properties/classes. */
  apply() {
    const p = this.theme;
    const r = document.documentElement.style;
    r.setProperty("--base", p.base);
    r.setProperty("--acc", p.acc);
    r.setProperty("--acc2", p.acc2);
    r.setProperty("--grad", `linear-gradient(135deg, ${p.acc2}, ${p.acc})`);
    r.setProperty("--wash", `color-mix(in srgb, ${p.acc} 15%, transparent)`);
    r.setProperty("--wash2", `color-mix(in srgb, ${p.acc2} 12%, transparent)`);
    document.documentElement.classList.toggle("reduce-motion", !this.motion);
    document.documentElement.classList.toggle("wall", this.density === "wall");
  }

  setPalette(id: PaletteId) { this.palette = id; this.apply(); this.save(); }

  resetWidgets() {
    this.widgets = { ...DEFAULTS.widgets };
    this.save();
  }
}

export const prefs = new Prefs();
