import { render } from "svelte/server";
import Notif from "../src/lib/components/SettingsNotifications.svelte";
import { setEntities } from "./stub-store";
export function run(list: Record<string, string | [string, Record<string, unknown>]>) {
  setEntities(list as never);
  return render(Notif as never, {}).body;
}
