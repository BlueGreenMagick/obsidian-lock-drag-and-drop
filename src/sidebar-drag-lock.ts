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

export interface DragLock {
  isLocked(): boolean;
  toggle(): void;
}

export type CurrentViewState =
  | { supported: true; view: View; lock: DragLock }
  | { supported: false; view: View | null };

interface SidebarView {
  navHeader: HTMLElement | null;
  view: View;
}

export class SidebarDragLockManager {
  private readonly controllers = new Map<HTMLElement, SidebarDragLockController>();
  private readonly stateChangeListeners = new Set<() => void>();
  private destroyed = false;

  constructor(
    private readonly workspace: Workspace,
    private readonly settings: LockDragAndDropSettings,
  ) {}

  getViews(): View[] {
    const views = new Map<string, View>();

    this.workspace.iterateAllLeaves((leaf) => {
      const sidebarView = this.getSidebarView(leaf);
      if (sidebarView === null) return;

      const { view } = sidebarView;
      const viewType = view.getViewType();
      if (!views.has(viewType)) views.set(viewType, view);
    });

    return Array.from(views.values());
  }

  getCurrentViewState(): CurrentViewState {
    const view = this.workspace.getActiveViewOfType(View);
    if (view !== null) {
      const lock = this.controllers.get(view.containerEl);
      if (lock !== undefined) return { supported: true, view, lock };
    }

    return { supported: false, view };
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
      if (sidebarView === null || !this.isViewTypeEnabled(sidebarView.view.getViewType())) return;

      sidebarViews.set(sidebarView.view.containerEl, sidebarView);
    });

    for (const [viewEl, controller] of this.controllers) {
      const sidebarView = sidebarViews.get(viewEl);
      if (sidebarView === undefined) {
        controller.destroy();
        this.controllers.delete(viewEl);
      }
    }

    for (const [viewEl, { navHeader }] of sidebarViews) {
      const visibleNavHeader = this.settings.interface.navHeader ? navHeader : null;
      const controller = this.controllers.get(viewEl);
      if (controller === undefined) {
        this.controllers.set(
          viewEl,
          new SidebarDragLockController(viewEl, visibleNavHeader, () => this.notifyStateChange()),
        );
      } else {
        controller.setNavHeader(visibleNavHeader);
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
    return {
      navHeader,
      view: leaf.view,
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

class SidebarDragLockController implements DragLock {
  private button: SidebarDragLockButton | null;
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

  setNavHeader(navHeader: HTMLElement | null): void {
    if (this.isAttachedTo(navHeader)) return;

    this.button?.destroy();
    this.button =
      navHeader === null ? null : new SidebarDragLockButton(navHeader, () => this.toggle());
    this.button?.setUnlocked(this.unlocked);
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
    const target = event.targetNode;
    if (target === null || !target.instanceOf(Element)) return;

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
        "aria-label": "Enable drag & drop",
        role: "button",
        tabindex: "0",
      },
    });
    setIcon(button, "move");

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
