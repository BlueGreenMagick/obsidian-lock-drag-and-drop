import { Plugin } from "obsidian";
import { SidebarDragLockManager } from "./sidebar-drag-lock";

export default class LockDragAndDropPlugin extends Plugin {
  onload(): void {
    const dragLockManager = new SidebarDragLockManager(this.app.workspace);

    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        dragLockManager.refresh();
      }),
    );
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        dragLockManager.refresh();
      }),
    );
    this.register(() => dragLockManager.destroy());

    this.app.workspace.onLayoutReady(() => dragLockManager.refresh());
  }
}
