export type GameType = 'poe' | 'poe2';

export interface PatchNote {
    title: string;
    link: string;
    date: string;
    isNew?: boolean;
}

export type BrowserType = 'chrome' | 'firefox' | 'edge' | 'brave';

export interface Notice {
    title: string;
    link: string;
    targetGame: GameType[];
    targetBrowser?: BrowserType[]; // Optional, defaults to all if undefined
}

export interface ThemeColors {
    text: string;
    accent: string;
    footer: string;
}

export interface AppSettings {
    closeTab: boolean;
    closePopup: boolean;
    pluginDisable: boolean;
    patchNoteCount: number; // 1~20
    cachedPatchNotes: Record<GameType, PatchNote[]>;
    cachedNotices: Notice[];
    cachedThemeColors: Record<string, ThemeColors>;
    selectedGame: GameType;
}

export const STORAGE_KEYS = {
    CLOSE_TAB: 'closeTab',
    CLOSE_POPUP: 'closePopup',
    PLUGIN_DISABLED: 'pluginDisable',
    SELECTED_GAME: 'selectedGame',
    PATCH_NOTE_COUNT: 'patchNoteCount',
    CACHED_PATCH_NOTES: 'cachedPatchNotes',
    CACHED_NOTICES: 'cachedNotices',
    CACHED_THEME_COLORS: 'cachedThemeColors'
} as const;

export const DEFAULT_SETTINGS: AppSettings = {
    closeTab: false,
    closePopup: false,
    pluginDisable: false,
    patchNoteCount: 4,
    cachedPatchNotes: { poe: [], poe2: [] },
    cachedNotices: [],
    cachedThemeColors: {},
    selectedGame: 'poe2'
};

/**
 * Loads all settings from storage, applying defaults for missing values.
 */
export async function loadSettings(): Promise<AppSettings> {
    return new Promise((resolve) => {
        chrome.storage.local.get(null, (result: { [key: string]: any }) => {
            const settings: AppSettings = {
                closeTab: (result[STORAGE_KEYS.CLOSE_TAB] as boolean) ?? DEFAULT_SETTINGS.closeTab,
                closePopup: (result[STORAGE_KEYS.CLOSE_POPUP] as boolean) ?? DEFAULT_SETTINGS.closePopup,
                pluginDisable: (result[STORAGE_KEYS.PLUGIN_DISABLED] as boolean) ?? DEFAULT_SETTINGS.pluginDisable,
                patchNoteCount: (result[STORAGE_KEYS.PATCH_NOTE_COUNT] as number) ?? DEFAULT_SETTINGS.patchNoteCount,
                cachedPatchNotes: (result[STORAGE_KEYS.CACHED_PATCH_NOTES] as Record<GameType, PatchNote[]>) ?? DEFAULT_SETTINGS.cachedPatchNotes,
                cachedNotices: (result[STORAGE_KEYS.CACHED_NOTICES] as Notice[]) ?? DEFAULT_SETTINGS.cachedNotices,
                cachedThemeColors: (result[STORAGE_KEYS.CACHED_THEME_COLORS] as Record<string, ThemeColors>) ?? DEFAULT_SETTINGS.cachedThemeColors,
                selectedGame: (result[STORAGE_KEYS.SELECTED_GAME] as GameType) ?? DEFAULT_SETTINGS.selectedGame
            };
            resolve(settings);
        });
    });
}

/**
 * Saves a single setting to storage.
 */
export function saveSetting<K extends keyof AppSettings>(key: string, value: AppSettings[K]): void {
    chrome.storage.local.set({ [key]: value });
}
