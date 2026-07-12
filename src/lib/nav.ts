export type ViewId =
  | "overview" | "energy" | "water" | "irrigation" | "climate" | "appliances"
  | "security" | "cameras" | "traffic" | "lights" | "system" | "me" | "timeline" | "settings";

export type NavItem = { id: ViewId; name: string; icon: string; group: "" | "Systems" | "Safety" | "House" };

export const NAV: NavItem[] = [
  { id: "overview", name: "Overview", icon: "🏠", group: "" },
  { id: "energy", name: "Energy", icon: "⚡", group: "Systems" },
  { id: "water", name: "Water", icon: "💧", group: "Systems" },
  { id: "irrigation", name: "Irrigation", icon: "🌿", group: "Systems" },
  { id: "climate", name: "Climate", icon: "🌡️", group: "Systems" },
  { id: "appliances", name: "Appliances", icon: "🔌", group: "Systems" },
  { id: "security", name: "Security", icon: "🛡️", group: "Safety" },
  { id: "cameras", name: "Cameras", icon: "📷", group: "Safety" },
  { id: "traffic", name: "Traffic", icon: "🚗", group: "Safety" },
  { id: "lights", name: "Lights", icon: "💡", group: "House" },
  { id: "system", name: "System", icon: "🖥️", group: "House" },
  { id: "me", name: "Me", icon: "👤", group: "House" },
  { id: "timeline", name: "Timeline", icon: "🕒", group: "House" },
  { id: "settings", name: "Settings", icon: "⚙️", group: "House" },
];
