import {
  Platform,
  View,
  setIcon,
  type Workspace,
  type WorkspaceItem,
  type WorkspaceLeaf,
} from "obsidian";
import type { LockDragAndDropSettings } from "./settings";

const NAV_HEADER_SELECTOR = ".nav-header";
const NAV_BUTTONS_SELECTOR = ".nav-buttons-container";
const TOGGLE_CLASS = "lock-drag-and-drop-toggle";

export interface SidebarViewType {
  displayText: string;
  viewType: string;
}

export type ToggleCurrentViewResult =
  | { displayText: string; locked: boolean; supported: true }
  | { displayText: string; supported: false };

interface SidebarView extends SidebarViewType {
  navHeader: HTMLElement | null;
  viewEl: HTMLElement;
}

export class SidebarDragLockManager {
  private readonly controllers = new Map<HTMLElement, SidebarDragLockController>();
  private readonly stateChangeListeners = new Set<() => void>();
  private destroyed = false;

  constructor(
    private readonly workspace: Workspace,
    private readonly settings: LockDragAndDropSettings,
  ) {}

  getViewTypes(): SidebarViewType[] {
    const viewTypes = new Map<string, SidebarViewType>();

    this.workspace.iterateAllLeaves((leaf) => {
      const sidebarView = this.getSidebarView(leaf);
      if (sidebarView === null || viewTypes.has(sidebarView.viewType)) return;

      viewTypes.set(sidebarView.viewType, {
        displayText: sidebarView.displayText,
        viewType: sidebarView.viewType,
      });
    });

    return Array.from(viewTypes.values()).sort((left, right) => {
      return left.displayText.localeCompare(right.displayText);
    });
  }

  getCurrentViewState(): ToggleCurrentViewResult {
    const view = this.workspace.getActiveViewOfType(View);
    const controller = view === null ? undefined : this.controllers.get(view.containerEl);
    const displayText = view?.getDisplayText().trim() || view?.getViewType() || "Current view";

    if (controller === undefined) {
      return {
        displayText,
        supported: false,
      };
    }

    return {
      displayText,
      locked: controller.isLocked(),
      supported: true,
    };
  }

  toggleCurrentView(): ToggleCurrentViewResult {
    const state = this.getCurrentViewState();
    if (!state.supported) return state;

    const view = this.workspace.getActiveViewOfType(View);
    const controller = view === null ? undefined : this.controllers.get(view.containerEl);
    if (controller === undefined) return { displayText: state.displayText, supported: false };

    controller.toggle();
    return {
      displayText: state.displayText,
      locked: controller.isLocked(),
      supported: true,
    };
  }

  onStateChange(callback: () => void): () => void {
    this.stateChangeListeners.add(callback);
    return () => {
      this.stateChangeListeners.delete(callback);
    };
  }

  refresh(): void {
    if (this.destroyed) return;

    const sidebarViews = new Map<HTMLElement, SidebarView>();

    this.workspace.iterateAllLeaves((leaf) => {
      const sidebarView = this.getSidebarView(leaf);
      if (sidebarView === null || !this.isViewTypeEnabled(sidebarView.viewType)) return;

      sidebarViews.set(sidebarView.viewEl, sidebarView);
    });

    for (const [viewEl, controller] of this.controllers) {
      const sidebarView = sidebarViews.get(viewEl);
      if (sidebarView === undefined || !controller.isAttachedTo(sidebarView.navHeader)) {
        controller.destroy();
        this.controllers.delete(viewEl);
      }
    }

    for (const [viewEl, { navHeader }] of sidebarViews) {
      if (!this.controllers.has(viewEl)) {
        this.controllers.set(
          viewEl,
          new SidebarDragLockController(viewEl, navHeader, () => this.notifyStateChange()),
        );
      }
    }

    this.notifyStateChange();
  }

  destroy(): void {
    this.destroyed = true;
    for (const controller of this.controllers.values()) {
      controller.destroy();
    }
    this.controllers.clear();
    this.stateChangeListeners.clear();
  }

  private getSidebarView(leaf: WorkspaceLeaf): SidebarView | null {
    if (!this.isSidebarLeaf(leaf)) return null;

    const navHeader = leaf.view.containerEl.querySelector<HTMLElement>(NAV_HEADER_SELECTOR);
    const viewType = leaf.view.getViewType();
    return {
      displayText: leaf.view.getDisplayText().trim() || viewType,
      navHeader,
      viewEl: leaf.view.containerEl,
      viewType,
    };
  }

  private isViewTypeEnabled(viewType: string): boolean {
    return this.settings.views[viewType]?.enabled ?? false;
  }

  private isSidebarLeaf(leaf: WorkspaceLeaf): boolean {
    let item: WorkspaceItem = leaf;
    const root = leaf.getRoot();

    while (true) {
      if (item === this.workspace.leftSplit || item === this.workspace.rightSplit) {
        return true;
      }
      if (item === root) return false;

      item = item.parent;
    }
  }

  private notifyStateChange(): void {
    for (const callback of this.stateChangeListeners) {
      callback();
    }
  }
}

class SidebarDragLockController {
  private readonly button: SidebarDragLockButton | null;
  private unlocked = false;

  constructor(
    private readonly viewEl: HTMLElement,
    navHeader: HTMLElement | null,
    private readonly onStateChange: () => void,
  ) {
    this.button =
      navHeader === null ? null : new SidebarDragLockButton(navHeader, () => this.toggle());

    this.viewEl.addEventListener("dragstart", this.handleDragStart, true);
    this.button?.setUnlocked(this.unlocked);
  }

  destroy(): void {
    this.viewEl.removeEventListener("dragstart", this.handleDragStart, true);
    this.button?.destroy();
  }

  isAttachedTo(navHeader: HTMLElement | null): boolean {
    if (navHeader === null) return this.button === null;
    return this.button?.isAttachedTo(navHeader) ?? false;
  }

  isLocked(): boolean {
    return !this.unlocked;
  }

  private readonly handleDragStart = (event: DragEvent): void => {
    if (this.unlocked) return;

    if (Platform.isMobile) {
      this.dispatchContextMenu(event);
    }
    event.preventDefault();
    event.stopPropagation();
  };

  toggle(): void {
    this.unlocked = !this.unlocked;
    this.button?.setUnlocked(this.unlocked);
    this.onStateChange();
  }

  private dispatchContextMenu(event: DragEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const MouseEventConstructor = target.ownerDocument.defaultView?.MouseEvent;
    if (MouseEventConstructor === undefined) return;

    target.dispatchEvent(
      new MouseEventConstructor("contextmenu", {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: target.ownerDocument.defaultView,
        detail: event.detail,
        screenX: event.screenX,
        screenY: event.screenY,
        clientX: event.clientX,
        clientY: event.clientY,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        metaKey: event.metaKey,
        button: 2,
      }),
    );
  }
}

class SidebarDragLockButton {
  private readonly buttonEl: HTMLElement;

  constructor(
    private readonly navHeader: HTMLElement,
    private readonly onToggle: () => void,
  ) {
    this.buttonEl = this.createButton();
    this.buttonEl.addEventListener("click", this.handleClick);
    this.buttonEl.addEventListener("keydown", this.handleKeyDown);
  }

  destroy(): void {
    this.buttonEl.removeEventListener("click", this.handleClick);
    this.buttonEl.removeEventListener("keydown", this.handleKeyDown);
    this.buttonEl.remove();
  }

  isAttachedTo(navHeader: HTMLElement): boolean {
    return this.navHeader === navHeader && navHeader.contains(this.buttonEl);
  }

  setUnlocked(unlocked: boolean): void {
    this.buttonEl.toggleClass("is-active", unlocked);
    this.buttonEl.setAttribute("aria-pressed", String(unlocked));
  }

  private createButton(): HTMLElement {
    const button = this.navHeader.createDiv({
      cls: ["clickable-icon", "nav-action-button", TOGGLE_CLASS],
      attr: {
        "aria-label": "Unlock drag and drop",
        role: "button",
        tabindex: "0",
      },
    });
    setIcon(button, "lock-open");

    const buttonContainer =
      this.navHeader.querySelector<HTMLElement>(NAV_BUTTONS_SELECTOR) ?? this.navHeader;
    buttonContainer.append(button);

    return button;
  }

  private readonly handleClick = (): void => {
    this.onToggle();
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    this.onToggle();
  };
}
