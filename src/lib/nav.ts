export type ViewId =
  | "now"
  | "home" | "overview" | "energy" | "powertrends" | "water" | "irrigation" | "climate" | "appliances"
  | "security" | "cameras" | "traffic" | "lights" | "reminders" | "trello" | "meals" | "fairplay" | "system" | "control" | "me" | "faith" | "kids" | "vitality" | "timeline" | "insights" | "usage" | "markets" | "solar" | "settings";

export type NavGroup = "" | "Energy" | "Water" | "Climate" | "Safety" | "Home" | "You" | "Bottom";

// `color` is the semantic domain tint for the item's icon (Aurora Command §2.4);
// `ic` is the line-icon name (see Icon.svelte). `icon` (emoji) kept as fallback.
// `color` is the semantic domain tint for the item's icon; `ic` is the line-icon
// name (see Icon.svelte); `icon` (emoji) is the fallback. `phoneOnly` keeps an
// item out of the desktop rail: Now and Home are two deliberately different
// front doors, and showing both on desktop would make them look like a choice
// when only one of them is the desktop answer.
export type NavItem = {
  id: ViewId;
  name: string;
  icon: string;
  ic: string;
  group: NavGroup;
  color: string;
  phoneOnly?: boolean;
};

export const NAV: NavItem[] = [
  { id: "now", name: "Now", icon: "◉", ic: "home", group: "", color: "var(--acc)", phoneOnly: true },
  { id: "home", name: "Home", icon: "🏠", ic: "home", group: "", color: "var(--acc)" },
  { id: "overview", name: "Dashboard", icon: "🧭", ic: "layout", group: "", color: "var(--acc)" },

  { id: "energy", name: "Energy", icon: "⚡", ic: "bolt", group: "Energy", color: "var(--energy)" },

  { id: "water", name: "Water", icon: "💧", ic: "droplet", group: "Water", color: "var(--water)" },
  { id: "irrigation", name: "Irrigation", icon: "🌿", ic: "leaf", group: "Water", color: "var(--water)" },

  { id: "climate", name: "Rooms", icon: "🚪", ic: "door", group: "Climate", color: "var(--climate)" },

  { id: "security", name: "Security", icon: "🛡️", ic: "shield", group: "Safety", color: "var(--security)" },
  { id: "cameras", name: "Cameras", icon: "📷", ic: "camera", group: "Safety", color: "var(--security)" },
  { id: "traffic", name: "Traffic", icon: "🚗", ic: "car", group: "Safety", color: "var(--security)" },

  { id: "lights", name: "Lights", icon: "💡", ic: "bulb", group: "Home", color: "var(--solar)" },
  { id: "appliances", name: "Appliances", icon: "🔌", ic: "plug", group: "Home", color: "var(--load)" },
  { id: "reminders", name: "Reminders", icon: "⏰", ic: "clock", group: "Home", color: "var(--acc)" },
  { id: "meals", name: "Meals", icon: "🍽️", ic: "pot", group: "Home", color: "var(--load)" },
  { id: "fairplay", name: "Fair Play", icon: "🃏", ic: "sliders", group: "Home", color: "var(--health)" },
  { id: "trello", name: "Trello", icon: "📋", ic: "board", group: "Home", color: "var(--acc)" },
  { id: "system", name: "System", icon: "🖥️", ic: "monitor", group: "Home", color: "var(--muted)" },
  { id: "control", name: "Control", icon: "🎛️", ic: "sliders", group: "Home", color: "var(--acc)" },

  { id: "me", name: "Me", icon: "👤", ic: "user", group: "You", color: "var(--health)" },
  { id: "faith", name: "Faith", icon: "🙏", ic: "book", group: "You", color: "var(--acc)" },
  { id: "kids", name: "Kids", icon: "🧒", ic: "user", group: "You", color: "var(--water)" },
  { id: "timeline", name: "Timeline", icon: "🕒", ic: "clock", group: "You", color: "var(--acc)" },

  { id: "insights", name: "Insights", icon: "📈", ic: "trending", group: "Bottom", color: "var(--acc)" },
  { id: "usage", name: "Usage", icon: "📊", ic: "chart", group: "Bottom", color: "var(--acc)" },
  { id: "markets", name: "Markets & Rates", icon: "💹", ic: "trending", group: "Bottom", color: "var(--acc)" },
  { id: "settings", name: "Settings", icon: "⚙️", ic: "gear", group: "Bottom", color: "var(--muted)" },
];

// Views hidden in guest mode (recc 5j) — security, cameras, location & health.
export const GUEST_HIDDEN: ViewId[] = ["security", "cameras", "traffic", "control", "me", "vitality", "timeline"];

// The domain groups rendered between Overview (top) and Insights/Settings (bottom).
export const NAV_GROUPS: { key: NavGroup; title: string }[] = [
  { key: "Energy", title: "Energy" },
  { key: "Water", title: "Water" },
  { key: "Climate", title: "Climate" },
  { key: "Safety", title: "Safety" },
  { key: "Home", title: "Home" },
  { key: "You", title: "You" },
];
