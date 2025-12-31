import { AppSettings } from './storage';

interface BaseSetting {
    key: keyof AppSettings;
    label: string;
    actionId?: string; // Optional identifier for special logic (side effects)
}

export interface SwitchSetting extends BaseSetting {
    type: 'switch';
    tooltip?: {
        icon: string;
        image: string; // assets path
    };
    styleClass?: string; // e.g., 'red'
}

export interface NumberSetting extends BaseSetting {
    type: 'number';
    min: number;
    max: number;
}

export type SettingItem = SwitchSetting | NumberSetting;

export const SETTINGS_CONFIG: SettingItem[] = [
    {
        type: 'switch',
        key: 'closeTab',
        label: '자동 실행 후 탭 닫기'
    },
    {
        type: 'switch',
        key: 'closePopup',
        label: '홈페이지 이벤트 창 자동 닫기',
        tooltip: { icon: 'i', image: 'assets/modal-info.png' }
    },
    {
        type: 'number',
        key: 'patchNoteCount',
        label: '패치노트 표시 수 (최대 20)',
        min: 1,
        max: 20,
        actionId: 'updatePatchNoteCount'
    },
    // IMPORTANT: 'pluginDisable' must always be the LAST item in this list.
    // This ensures the "Disable Plugin" toggle appears at the bottom of the settings UI.
    {
        type: 'switch',
        key: 'pluginDisable',
        label: '플러그인 비활성화',
        styleClass: 'red',
        actionId: 'togglePluginDisable'
    }
];
