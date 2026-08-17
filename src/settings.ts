import { PluginSettingTab, Setting, SettingGroup, type App } from "obsidian";
import type LockDragAndDropPlugin from "./main";
import { getViewDisplayText } from "./utils";

export interface LockDragAndDropSettings {
  views: Record<string, ViewSettings>;
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
