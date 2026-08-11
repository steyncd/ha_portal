// Refreshes .ssrcheck/zone-entities.json — every alarm-zone entity id the panel
// exposes. The render-check asserts the zones screen derives all 32 from these,
// so this needs re-running if zones are added, renamed or removed on the panel.
//
// Unlike the script fixture, this comes from the LIVE API rather than the config:
// zone entities are created by the Olarm integration, so they exist nowhere in
// YAML. Token from secrets.yaml on the config mount; read-only GET.
import { readFile, writeFile } from "node:fs/promises";

const CONFIG = "/Volumes/config";
const HA = "https://ha.helloliam.co.za";

const src = await readFile(`${CONFIG}/secrets.yaml`, "utf8");
const m = src.match(/^me_history_token:\s*(.+)$/m);
if (!m) { console.error("no me_history_token in secrets.yaml"); process.exit(1); }

const res = await fetch(`${HA}/api/states`, {
  headers: { Authorization: `Bearer ${m[1].trim().replace(/^["']|["']$/g, "")}` },
});
if (!res.ok) { console.error(`HA returned HTTP ${res.status}`); process.exit(1); }

const ids = (await res.json())
  .map((e) => e.entity_id)
  .filter((id) => id.includes("alarm_zone"))
  .sort();

await writeFile(new URL("../.ssrcheck/zone-entities.json", import.meta.url), JSON.stringify(ids));
const zones = new Set(ids.map((id) => id.match(/alarm_zone_(\d+)/)?.[1]).filter(Boolean));
console.log(`captured ${ids.length} entities across ${zones.size} zones`);
