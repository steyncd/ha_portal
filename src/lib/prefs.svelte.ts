// Persisted per-user preferences + the derived Aurora-Glass theme.

export type AccentId = "violet" | "emerald" | "cyan" | "amber" | "rose" | "mono" | "custom";

export const PALETTE: { id: AccentId; name: string; a: string; a2: string }[] = [
  { id: "violet", name: "Aurora Violet", a: "#a78bfa", a2: "#818cf8" },
  { id: "emerald", name: "Emerald Deep", a: "#34d399", a2: "#10b981" },
  { id: "cyan", name: "Ice Cyan", a: "#38bdf8", a2: "#22d3ee" },
  { id: "amber", name: "Sunset Amber", a: "#fbbf24", a2: "#fb923c" },
  { id: "rose", name: "Rose Quartz", a: "#fb7185", a2: "#f472b6" },
  { id: "mono", name: "Slate", a: "#cbd5e1", a2: "#94a3b8" },
];

const KEY = "ha_portal_prefs";

type Stored = {
  accent: AccentId;
  hue: number;
  motion: boolean;
  density: "comfortable" | "compact";
  collapsed: boolean;
  viewsOn: Record<string, boolean>;
  widgets: Record<string, boolean>;
};

const DEFAULTS: Stored = {
  accent: "violet",
  hue: 265,
  motion: true,
  density: "comfortable",
  collapsed: false,
  viewsOn: {
    energy: true, water: true, irrigation: true, climate: true, appliances: true,
    cameras: true, traffic: true, lights: true, system: true, me: true, timeline: true,
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
    return {
      ...DEFAULTS, ...p,
      viewsOn: { ...DEFAULTS.viewsOn, ...(p.viewsOn ?? {}) },
      widgets: { ...DEFAULTS.widgets, ...(p.widgets ?? {}) },
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

class Prefs {
  accent = $state<AccentId>(DEFAULTS.accent);
  hue = $state(DEFAULTS.hue);
  motion = $state(DEFAULTS.motion);
  density = $state<"comfortable" | "compact">(DEFAULTS.density);
  collapsed = $state(DEFAULTS.collapsed);
  viewsOn = $state<Record<string, boolean>>({ ...DEFAULTS.viewsOn });
  widgets = $state<Record<string, boolean>>({ ...DEFAULTS.widgets });

  constructor() {
    const s = load();
    this.accent = s.accent;
    this.hue = s.hue;
    this.motion = s.motion;
    this.density = s.density;
    this.collapsed = s.collapsed;
    this.viewsOn = s.viewsOn;
    this.widgets = s.widgets;
  }

  save() {
    const data: Stored = {
      accent: this.accent, hue: this.hue, motion: this.motion,
      density: this.density, collapsed: this.collapsed,
      viewsOn: this.viewsOn, widgets: this.widgets,
    };
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignore */ }
  }

  /** Current accent colours. */
  get acc() {
    if (this.accent === "custom") return `hsl(${this.hue} 80% 68%)`;
    return (PALETTE.find((p) => p.id === this.accent) ?? PALETTE[0]).a;
  }
  get acc2() {
    if (this.accent === "custom") return `hsl(${(this.hue + 28) % 360} 78% 64%)`;
    return (PALETTE.find((p) => p.id === this.accent) ?? PALETTE[0]).a2;
  }

  /** Apply theme to :root as CSS custom properties. */
  apply() {
    const r = document.documentElement.style;
    r.setProperty("--acc", this.acc);
    r.setProperty("--acc2", this.acc2);
    r.setProperty("--grad", `linear-gradient(135deg, ${this.acc2}, ${this.acc})`);
    document.documentElement.classList.toggle("reduce-motion", !this.motion);
  }

  resetWidgets() {
    this.widgets = { ...DEFAULTS.widgets };
    this.save();
  }
}

export const prefs = new Prefs();
