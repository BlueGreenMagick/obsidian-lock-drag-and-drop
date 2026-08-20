import { PluginSettingTab, SettingGroup, type App } from "obsidian";
import type LockDragAndDropPlugin from "./main";
import { getViewDisplayText } from "./utils";

export interface LockDragAndDropSettings {
  interface: InterfaceSettings;
  views: Record<string, ViewSettings>;
}

export interface InterfaceSettings {
  action: boolean;
  navHeader: boolean;
  statusBar: boolean;
}

export interface ViewSettings {
  /**
   * Whether the drag lock feature is enabled for the view.
   *
   * This is different from whether the view is 'locked'.
   * A view may be enabled and unlocked.
   *
   * default: `false`
   */
  enabled: boolean;
}

export const DEFAULT_SETTINGS: LockDragAndDropSettings = {
  interface: {
    action: false,
    navHeader: true,
    statusBar: false,
  },
  views: {
    "file-explorer": { enabled: true },
    outline: { enabled: true },
    bookmarks: { enabled: true },
  },
};

export function parseSettings(
  data: Partial<LockDragAndDropSettings> | null | undefined,
): LockDragAndDropSettings {
  return {
    interface: {
      ...DEFAULT_SETTINGS.interface,
      ...data?.interface,
    },
    views: {
      ...DEFAULT_SETTINGS.views,
      ...data?.views,
    },
  };
}

export class LockDragAndDropSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    readonly plugin: LockDragAndDropPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    const mainGroup = new SettingGroup(containerEl);

    mainGroup
      .addSetting((setting) => {
        setting
          .setName("Nav header")
          .setDesc("Show the lock button in enabled sidebar view headers.")
          .addToggle((toggle) => {
            toggle.setValue(this.plugin.settings.interface.navHeader);
            toggle.onChange(async (navHeader) => {
              this.plugin.settings.interface.navHeader = navHeader;
              this.plugin.refreshInterface();
              await this.plugin.saveData(this.plugin.settings);
            });
          });
      })
      .addSetting((setting) => {
        setting
          .setName("Status bar")
          .setDesc("Show the lock button in the status bar.")
          .addToggle((toggle) => {
            toggle.setValue(this.plugin.settings.interface.statusBar);
            toggle.onChange(async (statusBar) => {
              this.plugin.settings.interface.statusBar = statusBar;
              this.plugin.refreshInterface();
              await this.plugin.saveData(this.plugin.settings);
            });
          });
      })
      .addSetting((setting) => {
        setting
          .setName("Action")
          .setDesc("Show the toggle lock action in the command palette.")
          .addToggle((toggle) => {
            toggle.setValue(this.plugin.settings.interface.action);
            toggle.onChange(async (action) => {
              this.plugin.settings.interface.action = action;
              this.plugin.refreshInterface();
              await this.plugin.saveData(this.plugin.settings);
            });
          });
      });

    const viewsGroup = new SettingGroup(containerEl);
    viewsGroup.setHeading("Enabled views");

    const views = this.plugin.dragLockManager.getViews().sort((left, right) => {
      return getViewDisplayText(left).localeCompare(getViewDisplayText(right));
    });
    if (views.length === 0) {
      containerEl.createEl("p", {
        text: "No lockable sidebar views are currently open.",
        cls: "setting-item-description",
      });
      return;
    }

    for (const view of views) {
      const viewType = view.getViewType();
      viewsGroup.addSetting((setting) => {
        setting.setName(`${viewType} (${getViewDisplayText(view)})`);
        setting.addToggle((toggle) => {
          const { settings } = this.plugin;
          toggle.setValue(settings.views[viewType]?.enabled ?? false);
          toggle.onChange(async (enabled) => {
            settings.views[viewType] = {
              ...settings.views[viewType],
              enabled,
            };
            this.plugin.dragLockManager.refresh();
            await this.plugin.saveData(settings);
          });
        });
      });
    }
  }
}
