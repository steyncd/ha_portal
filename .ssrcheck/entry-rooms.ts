import { render } from "svelte/server";
import Rooms from "../src/views/Rooms.svelte";
import { setEntities } from "./stub-store";
export function run(list: Record<string, string>) {
  setEntities(list);
  return render(Rooms as never, { props: { onnav: () => {} } }).body;
}
