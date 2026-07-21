export type ViewId =
  | "overview" | "energy" | "powertrends" | "water" | "irrigation" | "climate" | "appliances"
  | "security" | "cameras" | "traffic" | "lights" | "reminders" | "system" | "me" | "vitality" | "timeline" | "insights" | "settings";

export type NavGroup = "" | "Energy" | "Water" | "Climate" | "Safety" | "Home" | "You" | "Bottom";

// `color` is the semantic domain tint for the item's icon (Aurora Command §2.4).
export type NavItem = { id: ViewId; name: string; icon: string; group: NavGroup; color: string };

export const NAV: NavItem[] = [
  { id: "overview", name: "Overview", icon: "🏠", group: "", color: "var(--acc)" },

  { id: "energy", name: "Energy", icon: "⚡", group: "Energy", color: "var(--energy)" },
  { id: "powertrends", name: "Power Trends", icon: "📊", group: "Energy", color: "var(--energy)" },

  { id: "water", name: "Water", icon: "💧", group: "Water", color: "var(--water)" },
  { id: "irrigation", name: "Irrigation", icon: "🌿", group: "Water", color: "var(--water)" },

  { id: "climate", name: "Rooms", icon: "🚪", group: "Climate", color: "var(--climate)" },

  { id: "security", name: "Security", icon: "🛡️", group: "Safety", color: "var(--security)" },
  { id: "cameras", name: "Cameras", icon: "📷", group: "Safety", color: "var(--security)" },
  { id: "traffic", name: "Traffic", icon: "🚗", group: "Safety", color: "var(--security)" },

  { id: "lights", name: "Lights", icon: "💡", group: "Home", color: "var(--solar)" },
  { id: "appliances", name: "Appliances", icon: "🔌", group: "Home", color: "var(--load)" },
  { id: "reminders", name: "Reminders", icon: "⏰", group: "Home", color: "var(--acc)" },
  { id: "system", name: "System", icon: "🖥️", group: "Home", color: "var(--muted)" },

  { id: "me", name: "Me", icon: "👤", group: "You", color: "var(--health)" },
  { id: "vitality", name: "Vitality", icon: "🏅", group: "You", color: "var(--health)" },
  { id: "timeline", name: "Timeline", icon: "🕒", group: "You", color: "var(--acc)" },

  { id: "insights", name: "Insights", icon: "📈", group: "Bottom", color: "var(--acc)" },
  { id: "settings", name: "Settings", icon: "⚙️", group: "Bottom", color: "var(--muted)" },
];

// The domain groups rendered between Overview (top) and Insights/Settings (bottom).
export const NAV_GROUPS: { key: NavGroup; title: string }[] = [
  { key: "Energy", title: "Energy" },
  { key: "Water", title: "Water" },
  { key: "Climate", title: "Climate" },
  { key: "Safety", title: "Safety" },
  { key: "Home", title: "Home" },
  { key: "You", title: "You" },
];
