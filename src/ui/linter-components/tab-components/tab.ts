import {iconInfo} from '../../../ui/icons';
import LinterPlugin from '../../../main';
import {RuleType} from '../../../rules';
import {setIcon, Setting} from 'obsidian';
import {settingSearchInfo} from './tab-searcher';
import {SearchOptionInfo} from '../../../option';
import {hideEl, unhideEl} from '../../../ui/helpers';
import {getTextInLanguage, LanguageStringKey} from '../../../lang/helpers';
import {GenericSetting} from '../../../ui/components/base-setting';

export enum SearchStatus {
  LeavingSearchMode = 'leaving search mode by selecting a tab',
  EnteringSearchMode = 'entering search mode by focusing on the search input box',
  None = 'the status is still the same'
}

const tabNameToTabIconId: Record<string | RuleType, string> = {
  'General': iconInfo.general.id,
  'Custom': iconInfo.custom.id,
  'YAML': iconInfo.yaml.id,
  'Headers': iconInfo.heading.id,
  'Body': iconInfo.content.id,
  'Special formatting': iconInfo.content.id,
  'Scopes': iconInfo.vault.id,
  'Rule order': iconInfo.whitespace.id,
  'Debug': iconInfo.debug.id,
};

const tabNameToTextKey: Record<string | RuleType, LanguageStringKey> = {
  'General': 'tabs.names.general',
  'Custom': 'tabs.names.custom',
  'YAML': 'tabs.names.yaml',
  'Headers': 'tabs.names.headers',
  'Body': 'tabs.names.body',
  'Special formatting': 'tabs.names.special-formatting',
  'Scopes': 'tabs.names.scopes',
  'Rule order': 'tabs.names.rule-order',
  'Debug': 'tabs.names.debug',
};

export abstract class Tab {
  contentEl: HTMLDivElement;
  headingEl: HTMLElement;
  navButton: HTMLDivElement;
  searchSettingInfo: settingSearchInfo[] = [];
  constructor(navEl: HTMLElement, settingsEl: HTMLElement, public name: string, public isMobile: boolean, protected plugin: LinterPlugin) {
    this.navButton = navEl.createDiv('linter-navigation-item');
    let tabClass = 'linter-desktop';
    if (isMobile) {
      tabClass = 'linter-mobile';
    }

    this.navButton.addClass(tabClass);
    setIcon(this.navButton.createSpan({cls: 'linter-navigation-item-icon'}), tabNameToTabIconId[name]);

    const nameInLanguage = getTextInLanguage(tabNameToTextKey[name]);
    this.navButton.createSpan().setText(nameInLanguage);

    this.contentEl = settingsEl.createDiv('linter-tab-settings');
    this.contentEl.id = name.toLowerCase().replaceAll(' ', '-');

    this.headingEl = new Setting(this.contentEl).setName(nameInLanguage).setHeading().nameEl;
    hideEl(this.headingEl);
  }

  abstract display(): void;

  addSettingSearchInfo(containerEl: HTMLDivElement, name: string = '', description: string = '', options: SearchOptionInfo[] = [], alias: string = undefined) {
    this.searchSettingInfo.push({
      containerEl: containerEl,
      name: name.toLowerCase(),
      description: description.toLowerCase(),
      options: options,
      alias: alias,
    });
  }

  addSettingSearchInfoForGeneralSettings(generalSetting: GenericSetting) {
    this.searchSettingInfo.push({
      containerEl: generalSetting.containerEl,
      name: generalSetting.name.toLowerCase(),
      description: generalSetting.description.toLowerCase(),
      options: [],
      alias: undefined,
    });
  }

  updateTabDisplayMode(isSelected: boolean, searchStatus: SearchStatus = SearchStatus.None) {
    if (isSelected) {
      this.navButton.addClass('linter-navigation-item-selected');
      unhideEl(this.contentEl);
    } else {
      this.navButton.removeClass('linter-navigation-item-selected');
      hideEl(this.contentEl);
    }

    switch (searchStatus) {
      case SearchStatus.EnteringSearchMode:
        unhideEl(this.contentEl);
        unhideEl(this.headingEl);
        for (const setting of this.searchSettingInfo) {
          unhideEl(setting.containerEl);
        }
        break;
      case SearchStatus.LeavingSearchMode:
        hideEl(this.headingEl);
        for (const setting of this.searchSettingInfo) {
          unhideEl(setting.containerEl);
        }
        break;
    }
  }
}
