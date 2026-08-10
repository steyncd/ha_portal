// Navigation — Phase 3.2.
//
// The sidebar went from 18 items to 9. Not by deleting anything: every view
// still exists, still routes, and is still reachable by ⌘K and by deep link.
// What changed is that fourteen of them stopped competing for a permanent slot.
//
// The count beside a hub is the number of views it collapsed, and it is DERIVED
// from `collapsed` below rather than typed in — a hardcoded 5 next to a list of
// four routes is the kind of thing nobody notices for a year.
//
// Deliberately NOT adaptive. A rail that reorders itself destroys the muscle
// memory that makes a rail worth having, and the frecency layer already has a
// home on Now, where reordering is the point.

export type ViewId =
  | "now"
  | "home" | "overview" | "energy" | "powertrends" | "water" | "irrigation" | "climate" | "appliances"
  | "security" | "cameras" | "traffic" | "lights" | "reminders" | "trello" | "meals" | "fairplay"
  | "household" | "system" | "control" | "me" | "faith" | "kids" | "vitality" | "timeline" | "insights"
  | "usage" | "markets" | "solar" | "settings"
  // Spokes: routed and deep-linkable, never in the rail.
  | "batteries" | "energydetail" | "medetail" | "devices" | "automations" | "assist" | "focus" | "server"
  | "waterdetail" | "securitydetail" | "diagnostics";

export type NavGroup = "" | "Energy" | "Water" | "Climate" | "Safety" | "Home" | "You" | "Bottom";

export type NavItem = {
  id: ViewId;
  name: string;
  icon: string;
  /** Line-icon name in Icon.svelte. Phase 3.2 uses the nav-* set, drawn from
   *  the prototype's NAVICON paths at 18px / 1.7px stroke / currentColor. */
  ic: string;
  group: NavGroup;
  color: string;
  /** Kept out of the desktop rail — Now is the phone's front door, Home is the
   *  desktop's, and offering both would read as a choice. */
  phoneOnly?: boolean;
  /** Views this hub folded in. Drives the rail's count. */
  collapsed?: ViewId[];
  /** What the hub collapsed, in words, for the board's note column. */
  collapsedNote?: string;
};

// ── The nine ────────────────────────────────────────────────────────────────
// Home and Dashboard are two front doors on purpose: Home answers "what now",
// Dashboard answers "show me everything". They must never render the same thing.
export const NAV: NavItem[] = [
  { id: "now", name: "Now", icon: "◉", ic: "nav-home", group: "", color: "var(--acc)", phoneOnly: true },
  { id: "home", name: "Home", icon: "🏠", ic: "nav-home", group: "", color: "var(--acc)" },
  { id: "overview", name: "Dashboard", icon: "🧭", ic: "nav-dashboard", group: "", color: "var(--acc)" },

  {
    id: "energy", name: "Energy", icon: "⚡", ic: "nav-energy", group: "", color: "var(--energy)",
    collapsed: ["energydetail", "solar", "powertrends", "batteries"],
    collapsedNote:
      "Energy, Solar, Power trends and Batteries answered the same question with different chrome. One board, one time axis, detail expands where you clicked. Appliances lives under Rooms — a metered appliance is a thing in a room that happens to draw power.",
  },
  {
    id: "water", name: "Water", icon: "💧", ic: "nav-water", group: "", color: "var(--water)",
    collapsed: ["waterdetail", "irrigation"],
    collapsedNote:
      "Water and Irrigation were one system pretending to be two — the same borehole, the same tank, the same pump hours.",
  },
  {
    id: "security", name: "Security", icon: "🛡️", ic: "nav-security", group: "", color: "var(--security)",
    collapsed: ["securitydetail", "cameras", "traffic", "timeline"],
    collapsedNote:
      "Zones, cameras, the road outside and the timeline are one question asked four ways: what happened, and was anyone here for it.",
  },
  {
    id: "climate", name: "Rooms", icon: "🚪", ic: "nav-rooms", group: "", color: "var(--climate)",
    // Rooms is the "things in the house" hub: the inventory, not the flow.
    // Appliances, Devices, Automations and System all answer "what is in this
    // house and is it working" — you look for the dishwasher where the
    // dishwasher is, not on a page about money.
    collapsed: ["lights", "appliances", "devices", "automations", "system"],
    collapsedNote:
      "The inventory of the house. The floor plan already knows which room a light is in, so Lights stopped being a list of switches with no places attached — and a metered appliance, a device, the automation that drives it and the box it all runs on are the same question asked four ways.",
  },
  {
    id: "household", name: "Household", icon: "👪", ic: "nav-household", group: "", color: "var(--health)",
    collapsed: ["kids", "meals", "faith", "fairplay", "trello", "reminders"],
    collapsedNote:
      "Six views about people rather than plumbing. Split from House on purpose: systems and family answer to different questions and different readers.",
  },
  {
    id: "me", name: "Me", icon: "👤", ic: "nav-me", group: "", color: "var(--health)",
    collapsed: ["medetail", "focus", "vitality", "usage", "insights"],
    collapsedNote:
      "Sleep, focus, what you actually used and the long-term patterns. Owner-only, and excluded from the family export.",
  },
  {
    id: "diagnostics", name: "Diagnostics", icon: "🩺", ic: "waves", group: "", color: "var(--ok)",
    collapsedNote:
      "Twelve subsystems, one screen. Every card names what depends on it — which is the sentence that turns a status into a decision.",
  },
  { id: "settings", name: "Settings", icon: "⚙️", ic: "nav-settings", group: "Bottom", color: "var(--mut)" },

  // ── Spokes ────────────────────────────────────────────────────────────────
  // Present in NAV so ⌘K, deep links and `visible()` all keep working; excluded
  // from the rail by SPOKE. Removing them from NAV would have been the easy
  // change and the wrong one: it is what turns "collapsed" into "deleted".
  { id: "energydetail", name: "Energy detail", icon: "⚡", ic: "bolt", group: "Bottom", color: "var(--energy)" },
  { id: "solar", name: "Solar", icon: "☀️", ic: "sun", group: "Bottom", color: "var(--energy)" },
  { id: "powertrends", name: "Power trends", icon: "📈", ic: "trending", group: "Bottom", color: "var(--load)" },
  { id: "batteries", name: "Batteries", icon: "🔋", ic: "plug", group: "Bottom", color: "var(--battery)" },
  { id: "appliances", name: "Appliances", icon: "🔌", ic: "plug", group: "Bottom", color: "var(--load)" },
  { id: "irrigation", name: "Irrigation", icon: "🌿", ic: "leaf", group: "Bottom", color: "var(--water)" },
  { id: "waterdetail", name: "Water detail", icon: "💧", ic: "droplet", group: "Bottom", color: "var(--water)" },
  { id: "securitydetail", name: "Security detail", icon: "🛡️", ic: "shield", group: "Bottom", color: "var(--security)" },
  { id: "cameras", name: "Cameras", icon: "📷", ic: "camera", group: "Bottom", color: "var(--security)" },
  { id: "traffic", name: "Traffic", icon: "🚗", ic: "car", group: "Bottom", color: "var(--security)" },
  { id: "timeline", name: "Timeline", icon: "🕒", ic: "clock", group: "Bottom", color: "var(--acc)" },
  { id: "lights", name: "Lights", icon: "💡", ic: "bulb", group: "Bottom", color: "var(--energy)" },
  { id: "vitality", name: "Vitality", icon: "🌡️", ic: "waves", group: "Bottom", color: "var(--health)" },
  { id: "kids", name: "Kids", icon: "🧒", ic: "user", group: "Bottom", color: "var(--water)" },
  { id: "meals", name: "Meals", icon: "🍽️", ic: "pot", group: "Bottom", color: "var(--load)" },
  { id: "faith", name: "Faith", icon: "🙏", ic: "book", group: "Bottom", color: "var(--acc)" },
  { id: "fairplay", name: "Fair Play", icon: "🃏", ic: "sliders", group: "Bottom", color: "var(--health)" },
  { id: "trello", name: "Trello", icon: "📋", ic: "board", group: "Bottom", color: "var(--acc)" },
  { id: "reminders", name: "Reminders", icon: "⏰", ic: "clock", group: "Bottom", color: "var(--acc)" },
  { id: "medetail", name: "Me detail", icon: "👤", ic: "user", group: "Bottom", color: "var(--health)" },
  { id: "focus", name: "Focus", icon: "🎯", ic: "cpu", group: "Bottom", color: "var(--health)" },
  { id: "usage", name: "Usage", icon: "📊", ic: "chart", group: "Bottom", color: "var(--acc)" },
  { id: "insights", name: "Insights", icon: "📈", ic: "trending", group: "Bottom", color: "var(--acc)" },
  { id: "markets", name: "Markets & Rates", icon: "💹", ic: "trending", group: "Bottom", color: "var(--acc)" },
  { id: "control", name: "Control", icon: "🎛️", ic: "sliders", group: "Bottom", color: "var(--acc)" },
  { id: "system", name: "System", icon: "🖥️", ic: "monitor", group: "Bottom", color: "var(--mut)" },
  { id: "devices", name: "Devices", icon: "🧩", ic: "cpu", group: "Bottom", color: "var(--mut)" },
  { id: "automations", name: "Automations", icon: "🤖", ic: "cpu", group: "Bottom", color: "var(--mut)" },
  { id: "assist", name: "Assist", icon: "💬", ic: "chat", group: "Bottom", color: "var(--acc)" },
  { id: "server", name: "Server", icon: "🖧", ic: "monitor", group: "Bottom", color: "var(--mut)" },
];

/** The nine that appear in the rail, in order. Everything else is a spoke. */
export const RAIL: ViewId[] = [
  "now", "home", "overview", "energy", "water", "security", "climate", "household", "me",
  "diagnostics", "settings",
];

export const isSpoke = (id: ViewId) => !RAIL.includes(id);

/** Count shown beside a hub — derived, never typed in. */
export function collapsedCount(id: ViewId): number {
  return NAV.find((n) => n.id === id)?.collapsed?.length ?? 0;
}

// Views hidden in guest mode — security, cameras, location and health.
export const GUEST_HIDDEN: ViewId[] = [
  "security", "cameras", "traffic", "control", "me", "medetail", "focus", "vitality", "timeline",
];

// Retained for the mobile "More" sheet, which still groups.
export const NAV_GROUPS: { key: NavGroup; title: string }[] = [
  { key: "Energy", title: "Energy" },
  { key: "Water", title: "Water" },
  { key: "Climate", title: "Climate" },
  { key: "Safety", title: "Safety" },
  { key: "Home", title: "Home" },
  { key: "You", title: "You" },
];
