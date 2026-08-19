import { setIcon } from "obsidian";
import type { SidebarDragLockManager } from "./sidebar-drag-lock";

const STATUS_BAR_BUTTON_CLASS = "lock-drag-and-drop-status-bar-button";

export class StatusBarDragLockButton {
  private readonly unsubscribeFromStateChanges: () => void;

  constructor(
    private readonly buttonEl: HTMLElement,
    private readonly dragLockManager: SidebarDragLockManager,
  ) {
    this.buttonEl.addClass("clickable-icon", STATUS_BAR_BUTTON_CLASS);
    setIcon(this.buttonEl, "lock-open");

    this.buttonEl.addEventListener("click", this.handleClick);
    this.unsubscribeFromStateChanges = this.dragLockManager.onStateChange(this.update);
    this.update();
  }

  destroy(): void {
    this.buttonEl.removeEventListener("click", this.handleClick);
    this.unsubscribeFromStateChanges();
    this.buttonEl.remove();
  }

  private readonly handleClick = (): void => {
    const state = this.dragLockManager.getCurrentViewState();
    if (!state.supported) return;

    state.lock.toggle();
  };

  private readonly update = (): void => {
    const state = this.dragLockManager.getCurrentViewState();
    const locked = state.supported && state.lock.isLocked();

    this.buttonEl.toggleClass("is-unavailable", !state.supported);
    this.buttonEl.toggleClass("is-active", state.supported && !locked);
    this.buttonEl.setAttribute("aria-disabled", String(!state.supported));
    this.buttonEl.setAttribute(
      "aria-label",
      locked ? "Unlock drag and drop" : "Lock drag and drop",
    );

    if (!state.supported) {
      this.buttonEl.setAttribute("aria-pressed", "false");
      return;
    }

    this.buttonEl.setAttribute("aria-pressed", String(!locked));
  };
}
