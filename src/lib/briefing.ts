// Client for the daily-briefing function (/api/briefing). Returns a composed
// morning ("today at a glance") or evening ("wind-down") digest built server-
// side from Home Assistant + the reminders calendar.
import { auth } from "./firebase";

export type BriefingLine = { icon: string; text: string };
export type Briefing = {
  ok: boolean;
  period: "morning" | "evening";
  title: string;
  lines: BriefingLine[];
  summary: string;
  speech: string;
  error?: string;
};

export async function getBriefing(period?: "morning" | "evening"): Promise<Briefing> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error("Not signed in");
  const q = period ? `?period=${period}` : "";
  const res = await fetch(`/api/briefing${q}`, { headers: { Authorization: `Bearer ${idToken}` } });
  return (await res.json()) as Briefing;
}
