import { render } from "svelte/server";
import Security from "../src/views/Security.svelte";
import { setEntities } from "./stub-store";
export function run(list: Record<string, string>) {
  setEntities(list);
  return render(Security as never, { props: { onnav: () => {} } }).body;
}
export { pressed } from "./stub-store";
