import { Notice, Plugin } from "obsidian";
import { SidebarDragLockManager } from "./sidebar-drag-lock";
import { LockDragAndDropSettingTab, type LockDragAndDropSettings, parseSettings } from "./settings";

export default class LockDragAndDropPlugin extends Plugin {
  settings!: LockDragAndDropSettings;
  dragLockManager!: SidebarDragLockManager;

  async onload(): Promise<void> {
    this.settings = parseSettings(await this.loadSavedSettings());
    this.dragLockManager = new SidebarDragLockManager(this.app.workspace, this.settings);

    this.addSettingTab(new LockDragAndDropSettingTab(this.app, this));
    this.addCommand({
      id: "toggle-lock",
      name: "Toggle lock",
      icon: "lock",
      callback: () => {
        const result = this.dragLockManager.toggleCurrentView();
        if (!result.supported) {
          new Notice(`"${result.displayText}" is not supported`);
        }
      },
    });

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

  async loadSavedSettings(): Promise<Partial<LockDragAndDropSettings> | null> {
    return this.loadData() as Partial<LockDragAndDropSettings> | null;
  }
}
