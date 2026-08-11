#!/usr/bin/env node
// Extract the curated entity ids from entities.ts for the Functions to use.
//
// The cadence job needs to know WHICH entities to measure. The portal's curated
// list is the right answer — measuring all 4 623 would cost far more and tell us
// about entities nothing reads. Generated rather than duplicated, so the two
// cannot drift.
import { readFile, writeFile } from "node:fs/promises";

const src = await readFile("src/lib/entities.ts", "utf8");
const DOMAINS = "sensor|binary_sensor|switch|light|input_boolean|input_number|alarm_control_panel|climate|counter|person|device_tracker|cover|lock|number|select";
const ids = [...new Set([...src.matchAll(new RegExp(`"(?:${DOMAINS})\\.[a-z0-9_]+"`, "g"))].map((m) => m[0].slice(1, -1)))].sort();
await writeFile("functions/curated-entities.json", JSON.stringify({ generatedAt: new Date().toISOString(), count: ids.length, ids }, null, 0));
console.log(`curated entities: ${ids.length} -> functions/curated-entities.json`);
