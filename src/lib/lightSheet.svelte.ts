class LightSheet {
  id = $state<string | null>(null);
  name = $state("");
  open(id: string, name: string) {
    this.id = id;
    this.name = name;
  }
  close() {
    this.id = null;
  }
}
export const lightSheet = new LightSheet();
