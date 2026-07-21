export type ViewId =
  | "overview" | "energy" | "powertrends" | "water" | "irrigation" | "climate" | "appliances"
  | "security" | "cameras" | "traffic" | "lights" | "reminders" | "system" | "me" | "vitality" | "timeline" | "insights" | "settings";

export type NavGroup = "" | "Energy" | "Water" | "Climate" | "Safety" | "Home" | "You" | "Bottom";

// `color` is the semantic domain tint for the item's icon (Aurora Command §2.4);
// `ic` is the line-icon name (see Icon.svelte). `icon` (emoji) kept as fallback.
export type NavItem = { id: ViewId; name: string; icon: string; ic: string; group: NavGroup; color: string };

export const NAV: NavItem[] = [
  { id: "overview", name: "Overview", icon: "🏠", ic: "home", group: "", color: "var(--acc)" },

  { id: "energy", name: "Energy", icon: "⚡", ic: "bolt", group: "Energy", color: "var(--energy)" },
  { id: "powertrends", name: "Power Trends", icon: "📊", ic: "chart", group: "Energy", color: "var(--energy)" },

  { id: "water", name: "Water", icon: "💧", ic: "droplet", group: "Water", color: "var(--water)" },
  { id: "irrigation", name: "Irrigation", icon: "🌿", ic: "leaf", group: "Water", color: "var(--water)" },

  { id: "climate", name: "Rooms", icon: "🚪", ic: "door", group: "Climate", color: "var(--climate)" },

  { id: "security", name: "Security", icon: "🛡️", ic: "shield", group: "Safety", color: "var(--security)" },
  { id: "cameras", name: "Cameras", icon: "📷", ic: "camera", group: "Safety", color: "var(--security)" },
  { id: "traffic", name: "Traffic", icon: "🚗", ic: "car", group: "Safety", color: "var(--security)" },

  { id: "lights", name: "Lights", icon: "💡", ic: "bulb", group: "Home", color: "var(--solar)" },
  { id: "appliances", name: "Appliances", icon: "🔌", ic: "plug", group: "Home", color: "var(--load)" },
  { id: "reminders", name: "Reminders", icon: "⏰", ic: "clock", group: "Home", color: "var(--acc)" },
  { id: "system", name: "System", icon: "🖥️", ic: "monitor", group: "Home", color: "var(--muted)" },

  { id: "me", name: "Me", icon: "👤", ic: "user", group: "You", color: "var(--health)" },
  { id: "vitality", name: "Vitality", icon: "🏅", ic: "award", group: "You", color: "var(--health)" },
  { id: "timeline", name: "Timeline", icon: "🕒", ic: "clock", group: "You", color: "var(--acc)" },

  { id: "insights", name: "Insights", icon: "📈", ic: "trending", group: "Bottom", color: "var(--acc)" },
  { id: "settings", name: "Settings", icon: "⚙️", ic: "gear", group: "Bottom", color: "var(--muted)" },
];

// Views hidden in guest mode (recc 5j) — security, cameras, location & health.
export const GUEST_HIDDEN: ViewId[] = ["security", "cameras", "traffic", "me", "vitality", "timeline"];

// The domain groups rendered between Overview (top) and Insights/Settings (bottom).
export const NAV_GROUPS: { key: NavGroup; title: string }[] = [
  { key: "Energy", title: "Energy" },
  { key: "Water", title: "Water" },
  { key: "Climate", title: "Climate" },
  { key: "Safety", title: "Safety" },
  { key: "Home", title: "Home" },
  { key: "You", title: "You" },
];
