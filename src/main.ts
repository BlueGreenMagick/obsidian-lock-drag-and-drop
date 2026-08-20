import { Notice, Plugin } from "obsidian";
import { SidebarDragLockManager } from "./sidebar-drag-lock";
import { LockDragAndDropSettingTab, type LockDragAndDropSettings, parseSettings } from "./settings";
import { StatusBarDragLockButton } from "./status-bar-drag-lock-button";
import { getViewDisplayText } from "./utils";

export default class LockDragAndDropPlugin extends Plugin {
  settings!: LockDragAndDropSettings;
  dragLockManager!: SidebarDragLockManager;
  private statusBarButton: StatusBarDragLockButton | null = null;

  async onload(): Promise<void> {
    this.settings = parseSettings(await this.loadSavedSettings());
    this.dragLockManager = new SidebarDragLockManager(this.app.workspace, this.settings);

    this.addSettingTab(new LockDragAndDropSettingTab(this.app, this));

    this.addCommand({
      id: "toggle-lock",
      name: "Toggle",
      icon: "move",
      checkCallback: (checking) => {
        if (!this.settings.interface.action) return false;
        if (!checking) this.toggleLock();
        return true;
      },
    });

    this.refreshInterface();
    this.register(() => this.statusBarButton?.destroy());

    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        this.dragLockManager.refresh();
      }),
    );
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.dragLockManager.refresh();
      }),
    );
    this.register(() => this.dragLockManager.destroy());

    this.app.workspace.onLayoutReady(() => this.dragLockManager.refresh());
  }

  refreshInterface(): void {
    this.dragLockManager.refresh();

    if (this.settings.interface.statusBar && this.statusBarButton === null) {
      this.statusBarButton = new StatusBarDragLockButton(
        this.addStatusBarItem(),
        this.dragLockManager,
      );
    } else if (!this.settings.interface.statusBar && this.statusBarButton !== null) {
      this.statusBarButton.destroy();
      this.statusBarButton = null;
    }
  }

  async loadSavedSettings(): Promise<Partial<LockDragAndDropSettings> | null> {
    return this.loadData() as Partial<LockDragAndDropSettings> | null;
  }

  private readonly toggleLock = (): void => {
    const state = this.dragLockManager.getCurrentViewState();
    if (!state.supported) {
      new Notice(`"${getViewDisplayText(state.view)}" is not supported`);
      return;
    }

    state.lock.toggle();
  };
}
