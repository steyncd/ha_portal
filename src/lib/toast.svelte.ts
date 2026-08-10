// Toast + undo — Phase 2.2.
//
// The brief's rule: one tap plus a 5s undo toast REPLACES confirmation dialogs
// everywhere except arming. A confirm dialog taxes every correct action to guard
// against the rare wrong one; undo taxes only the mistake. Arming is the
// exception because you cannot undo a siren that has already woken the street.

export type ToastAction = {
  label: string;
  run: () => void;
};

class ToastStore {
  msg = $state("");
  /** Present only while an undo is offered. */
  action = $state<ToastAction | null>(null);
  /** 0–1, drains over the undo window so the toast can show time running out. */
  progress = $state(0);

  #timer: ReturnType<typeof setTimeout> | undefined;
  #raf: ReturnType<typeof setInterval> | undefined;

  #clear() {
    clearTimeout(this.#timer);
    clearInterval(this.#raf);
    this.#timer = undefined;
    this.#raf = undefined;
  }

  /** Plain transient message. */
  show(message: string, ms = 2600) {
    this.#clear();
    this.msg = message;
    this.action = null;
    this.progress = 0;
    this.#timer = setTimeout(() => this.dismiss(), ms);
  }

  /**
   * Message with an undo affordance. `undo` should reverse the action that was
   * just performed — it is NOT a "cancel before it happens" prompt. The action
   * has already run; this puts it back.
   */
  showUndo(message: string, undo: () => void, ms = 5000) {
    this.#clear();
    this.msg = message;
    this.action = { label: "Undo", run: undo };
    this.progress = 1;

    const start = Date.now();
    // 100ms tick rather than rAF: this drives a 1px-ish bar, so 60fps buys
    // nothing and rAF would keep the main thread busy for the whole window.
    this.#raf = setInterval(() => {
      const left = 1 - (Date.now() - start) / ms;
      this.progress = Math.max(0, left);
    }, 100);
    this.#timer = setTimeout(() => this.dismiss(), ms);
  }

  /** Run the offered action and close. */
  fire() {
    const a = this.action;
    this.dismiss();
    a?.run();
  }

  dismiss() {
    this.#clear();
    this.msg = "";
    this.action = null;
    this.progress = 0;
  }
}

export const toast = new ToastStore();
