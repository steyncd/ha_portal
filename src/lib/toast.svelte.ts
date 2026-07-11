class ToastStore {
  msg = $state("");
  #timer: ReturnType<typeof setTimeout> | undefined;

  show(message: string) {
    this.msg = message;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => (this.msg = ""), 2600);
  }
}
export const toast = new ToastStore();
