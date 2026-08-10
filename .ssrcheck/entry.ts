import { render } from "svelte/server";
import Buttons from "../src/lib/components/SettingsButtons.svelte";
import { setEntities } from "./stub-store";
export function run(list: Record<string, string>, names: Record<string, string> = {}) {
  setEntities(list, names);
  return render(Buttons as never, {}).body;
}
