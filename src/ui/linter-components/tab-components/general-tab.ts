import LinterPlugin from '../../../main';
import {Tab} from './tab';
import {App} from 'obsidian';
import {moment} from 'obsidian';
import {getTextInLanguage} from '../../../lang/helpers';
import {DropdownRecordInfo, DropdownSetting} from '../../../ui/components/dropdown-setting';
import {ToggleSetting} from '../../../ui/components/toggle-setting';
import {FolderIgnoreOption} from '../folder-ignore-option';
import {FilesToIgnoreOption} from '../files-to-ignore-option';
import {AdditionalFileExtensionsOption} from '../additional-file-extensions-option';

export class GeneralTab extends Tab {
  constructor(navEl: HTMLElement, settingsEl: HTMLElement, isMobile: boolean, plugin: LinterPlugin, private app: App) {
    super(navEl, settingsEl, 'General', isMobile, plugin);
    this.display();
  }

  display(): void {
    let tempDiv = this.contentEl.createDiv();

    let displayCharactersChangedSetting: ToggleSetting | null = null;
    const lintOnSaveSetting = new ToggleSetting(tempDiv, 'tabs.general.lint-on-save.name', 'tabs.general.lint-on-save.description', 'lintOnSave', this.plugin, (value: boolean) => {
      if (value) {
        displayCharactersChangedSetting!.unhide();
      } else {
        displayCharactersChangedSetting!.hide();
      }
    });
    this.addSettingSearchInfoForGeneralSettings(lintOnSaveSetting);

    tempDiv = this.contentEl.createDiv();
    displayCharactersChangedSetting = new ToggleSetting(tempDiv, 'tabs.general.display-message.name', 'tabs.general.display-message.description', 'displayChanged', this.plugin);
    this.addSettingSearchInfoForGeneralSettings(displayCharactersChangedSetting);
    if (!lintOnSaveSetting.getBoolean()) {
      displayCharactersChangedSetting.hide();
    }

    let displayLintOnActiveFileChangeSetting: ToggleSetting | null = null;
    tempDiv = this.contentEl.createDiv();
    const lintOnActiveFileChangeSetting = new ToggleSetting(tempDiv, 'tabs.general.lint-on-file-change.name', 'tabs.general.lint-on-file-change.description', 'lintOnFileChange', this.plugin, (value: boolean) => {
      if (value) {
        displayLintOnActiveFileChangeSetting!.unhide();
      } else {
        displayLintOnActiveFileChangeSetting!.hide();
      }
    });
    this.addSettingSearchInfoForGeneralSettings(lintOnActiveFileChangeSetting);

    tempDiv = this.contentEl.createDiv();
    displayLintOnActiveFileChangeSetting = new ToggleSetting(tempDiv, 'tabs.general.display-lint-on-file-change-message.name', 'tabs.general.display-lint-on-file-change-message.description', 'displayLintOnFileChangeNotice', this.plugin);
    this.addSettingSearchInfoForGeneralSettings(displayLintOnActiveFileChangeSetting);
    if (!lintOnActiveFileChangeSetting.getBoolean()) {
      displayLintOnActiveFileChangeSetting.hide();
    }

    tempDiv = this.contentEl.createDiv();
    const suppressMessageWhenNoChangeSetting = new ToggleSetting( tempDiv, 'tabs.general.suppress-message-when-no-change.name', 'tabs.general.suppress-message-when-no-change.description', 'suppressMessageWhenNoChange', this.plugin);
    this.addSettingSearchInfoForGeneralSettings(suppressMessageWhenNoChangeSetting);

    const sysLocale = navigator.language?.toLowerCase();
    const localeValues = ['system-default'];
    const localeDescriptions = [getTextInLanguage('tabs.general.same-as-system-locale').replace('{SYS_LOCALE}', sysLocale)];
    for (const locale of moment.locales()) {
      localeValues.push(locale);
      localeDescriptions.push(locale);
    }

    const localeDropdownRecordInfo: DropdownRecordInfo = {
      isForEnum: false,
      values: localeValues,
      descriptions: localeDescriptions,
    };

    tempDiv = this.contentEl.createDiv();
    this.addSettingSearchInfoForGeneralSettings(new DropdownSetting(tempDiv, 'tabs.general.override-locale.name', 'tabs.general.override-locale.description', 'linterLocale', this.plugin, localeDropdownRecordInfo, async () => {
      await this.plugin.setOrUpdateMomentInstance();
    }));

    // The legacy "YAML Common Style" cluster (alias/tag array styles, escape
    // character, escape-char cleanup, math-block dollar signs) is intentionally
    // not surfaced here: the redesign moved YAML formatting to the dedicated
    // YAML tab (dec-005), and re-exposing these controls is the duplication the
    // recovered spec asked to remove. The underlying commonStyles.* settings
    // keep their compiled defaults; only the redundant UI is gone.

    const folderIgnoreEl = this.contentEl.createDiv();
    const folderIgnore = new FolderIgnoreOption(folderIgnoreEl, this.plugin.settings.foldersToIgnore, this.app, () => {
      void this.plugin.saveSettings();
    });

    this.addSettingSearchInfo(folderIgnoreEl, folderIgnore.name, folderIgnore.description.replaceAll('\n', ' '));

    const filesToIgnoreEl = this.contentEl.createDiv();
    const filesToIgnore = new FilesToIgnoreOption(filesToIgnoreEl, this.plugin.settings.filesToIgnore, this.app, () => {
      void this.plugin.saveSettings();
    });

    this.addSettingSearchInfo(filesToIgnoreEl, filesToIgnore.name, filesToIgnore.description.replaceAll('\n', ' '));

    const additionalFileExtensionsEl = this.contentEl.createDiv();
    const additionalFileExtensions = new AdditionalFileExtensionsOption(additionalFileExtensionsEl, this.plugin.settings.additionalFileExtensions, this.app, () => {
      void this.plugin.saveSettings();
    });

    this.addSettingSearchInfo(additionalFileExtensionsEl, additionalFileExtensions.name, additionalFileExtensions.description.replaceAll('\n', ' '));
  }
}
