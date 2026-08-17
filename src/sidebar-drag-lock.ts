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
  | { supported: true }
  | { displayText: string; supported: false };

interface SidebarView extends SidebarViewType {
  navHeader: HTMLElement;
  viewEl: HTMLElement;
}

export class SidebarDragLockManager {
  private readonly controllers = new Map<HTMLElement, SidebarDragLockController>();
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

  toggleCurrentView(): ToggleCurrentViewResult {
    const view = this.workspace.getActiveViewOfType(View);
    const controller = view === null ? undefined : this.controllers.get(view.containerEl);

    if (controller === undefined) {
      return {
        displayText: view?.getDisplayText().trim() || view?.getViewType() || "Current view",
        supported: false,
      };
    }

    controller.toggle();
    return { supported: true };
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
        this.controllers.set(viewEl, new SidebarDragLockController(viewEl, navHeader));
      }
    }
  }

  destroy(): void {
    this.destroyed = true;
    for (const controller of this.controllers.values()) {
      controller.destroy();
    }
    this.controllers.clear();
  }

  private getSidebarView(leaf: WorkspaceLeaf): SidebarView | null {
    if (!this.isSidebarLeaf(leaf)) return null;

    const navHeader = leaf.view.containerEl.querySelector<HTMLElement>(NAV_HEADER_SELECTOR);
    if (navHeader === null) return null;

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
}

class SidebarDragLockController {
  readonly navHeader: HTMLElement;

  private readonly buttonEl: HTMLElement;
  private unlocked = false;

  constructor(
    private readonly viewEl: HTMLElement,
    navHeader: HTMLElement,
  ) {
    this.navHeader = navHeader;
    this.buttonEl = this.createButton(navHeader);

    this.buttonEl.addEventListener("click", this.handleClick);
    this.buttonEl.addEventListener("keydown", this.handleKeyDown);
    this.viewEl.addEventListener("dragstart", this.handleDragStart, true);
    this.updateButton();
  }

  destroy(): void {
    this.buttonEl.removeEventListener("click", this.handleClick);
    this.buttonEl.removeEventListener("keydown", this.handleKeyDown);
    this.viewEl.removeEventListener("dragstart", this.handleDragStart, true);
    this.buttonEl.remove();
  }

  isAttachedTo(navHeader: HTMLElement): boolean {
    return this.navHeader === navHeader && navHeader.contains(this.buttonEl);
  }

  private createButton(navHeader: HTMLElement): HTMLElement {
    const button = navHeader.createDiv({
      cls: ["clickable-icon", "nav-action-button", TOGGLE_CLASS],
      attr: {
        "aria-label": "Unlock drag and drop",
        role: "button",
        tabindex: "0",
      },
    });
    setIcon(button, "lock-open");

    const buttonContainer = navHeader.querySelector<HTMLElement>(NAV_BUTTONS_SELECTOR) ?? navHeader;
    buttonContainer.append(button);

    return button;
  }

  private readonly handleClick = (): void => {
    this.toggle();
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    this.toggle();
  };

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
    this.updateButton();
  }

  private updateButton(): void {
    this.buttonEl.toggleClass("is-active", this.unlocked);
    this.buttonEl.setAttribute("aria-pressed", String(this.unlocked));
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
