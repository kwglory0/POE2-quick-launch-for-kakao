import {
    loadSettings,
    saveSetting,
    STORAGE_KEYS,
    DEFAULT_SETTINGS,
    GameType,
    PatchNote,
    Notice,
    ThemeColors,
    AppSettings,
    BrowserType
} from './storage';
import { SETTINGS_CONFIG, SettingItem } from './settings';
import { fetchPatchNotes, getPatchNoteUrl } from './patch-notes';
import { fetchNotices } from './notice';
import { extractThemeColors, applyThemeColors } from './utils/theme';

// Assets
import bgPoe from './assets/poe/bg-keepers.png';
import bgPoe2 from './assets/poe2/bg-forest.webp';

const launchBtn = document.getElementById('launchBtn') as HTMLAnchorElement;
const noticeContainer = document.getElementById('noticeContainer') as HTMLDivElement;
const btnHomepage = document.getElementById('btnHomepage') as HTMLAnchorElement;
const btnTrade = document.getElementById('btnTrade') as HTMLAnchorElement;
const settingsContainer = document.getElementById('settingsContainer') as HTMLDivElement;

// Patch Note Elements
const patchNoteListPoe = document.getElementById('patchNoteList-poe') as HTMLUListElement;
const patchNoteListPoe2 = document.getElementById('patchNoteList-poe2') as HTMLUListElement;
const patchNoteMoreBtn = document.getElementById('patchNoteMoreBtn') as HTMLAnchorElement;

// Game Switcher Elements
const logoPoe = document.getElementById('logoPoe') as HTMLImageElement;
const logoPoe2 = document.getElementById('logoPoe2') as HTMLImageElement;

// Tab Elements
const tabBtnPatchNotes = document.getElementById('tabBtnPatchNotes') as HTMLButtonElement;
const tabBtnHelp = document.getElementById('tabBtnHelp') as HTMLButtonElement;
const tabBtnSettings = document.getElementById('tabBtnSettings') as HTMLButtonElement;
const tabPanelPatchNotes = document.getElementById('tabPanelPatchNotes') as HTMLDivElement;
const tabPanelHelp = document.getElementById('tabPanelHelp') as HTMLDivElement;
const tabPanelSettings = document.getElementById('tabPanelSettings') as HTMLDivElement;

let selectedGame: GameType = 'poe2'; // Default local state, will be updated from storage
let patchNoteCount = DEFAULT_SETTINGS.patchNoteCount;
let cachedPatchNotes: Record<GameType, PatchNote[]> = { poe: [], poe2: [] };
let cachedNotices: Notice[] = [];
let cachedThemeColors: Record<string, ThemeColors> = {};

// Game Configuration
const GAME_CONFIG = {
    poe: {
        bgClass: 'bg-poe',
        bgImage: bgPoe,
        url: 'https://poe.game.daum.net#autoStart',
        homepageUrl: 'https://poe.game.daum.net/',
        tradeUrl: 'https://poe.game.daum.net/trade',
        fallback: {
            text: '#c8c8c8',
            accent: '#dfcf99', // Gold
            footer: '#1a1510' // Dark Brown/Black
        }
    },
    poe2: {
        bgClass: 'bg-poe2',
        bgImage: bgPoe2,
        url: 'https://pathofexile2.game.daum.net/main#autoStart',
        homepageUrl: 'https://pathofexile2.game.daum.net/main',
        tradeUrl: 'https://poe.game.daum.net/trade2',
        fallback: {
            text: '#b5c2b5',
            accent: '#aaddaa', // Mint
            footer: '#0c150c' // Dark Green
        }
    }
};

// ... Color Utils (Keep reused logic, omitted for brevity if unchanged, but included here for completeness) ...

function updateMoreButton(game: GameType) {
    if (patchNoteMoreBtn) {
        const apiGame = game === 'poe' ? 'poe1' : 'poe2';
        patchNoteMoreBtn.href = getPatchNoteUrl(apiGame);
    }
}

let currentBrowser: BrowserType = 'chrome';

async function detectBrowser(): Promise<BrowserType> {
    const ua = navigator.userAgent;
    if (ua.includes('Firefox')) return 'firefox';
    if (ua.includes('Edg')) return 'edge';
    // Brave Detection (Async)
    if ((navigator as any).brave && (await (navigator as any).brave.isBrave())) {
        return 'brave';
    }
    return 'chrome';
}

function renderNotices(notices: Notice[], game: GameType) {
    if (!noticeContainer) return;
    noticeContainer.innerHTML = '';

    const currentNotices = notices.filter((n) => {
        // 1. Check Game Target
        const isGameMatch = n.targetGame.includes(game);
        if (!isGameMatch) return false;

        // 2. Check Browser Target (Optional, default to all)
        if (!n.targetBrowser || n.targetBrowser.length === 0) return true;
        return n.targetBrowser.includes(currentBrowser);
    });

    currentNotices.forEach((notice) => {
        const a = document.createElement('a');
        a.className = 'sub-link';
        a.href = notice.link;
        a.target = '_blank';

        const hoverOverlay = document.createElement('span');
        hoverOverlay.className = 'hover-overlay';

        const btnText = document.createElement('span');
        btnText.className = 'btn-text';
        btnText.textContent = notice.title;

        a.appendChild(hoverOverlay);
        a.appendChild(btnText);
        noticeContainer.appendChild(a);
    });
}

function renderPatchNotes(notes: PatchNote[], game: GameType) {
    const listElement = game === 'poe' ? patchNoteListPoe : patchNoteListPoe2;
    if (!listElement) return;

    listElement.innerHTML = '';

    if (notes.length === 0) {
        listElement.innerHTML = '<li class="empty">패치노트가 없습니다.</li>';
        return;
    }

    notes.forEach((note) => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = note.link;
        a.target = '_blank';

        const titleSpan = document.createElement('span');
        titleSpan.className = 'note-title';
        titleSpan.textContent = note.title;
        a.appendChild(titleSpan);

        if (note.isNew) {
            const badge = document.createElement('span');
            badge.className = 'new-badge';
            badge.textContent = 'N';
            a.appendChild(badge);
        }

        const dateSpan = document.createElement('span');
        dateSpan.className = 'note-date';
        dateSpan.textContent = note.date;

        li.appendChild(a);
        li.appendChild(dateSpan);
        listElement.appendChild(li);
    });
}

function updatePatchNotes(game: GameType) {
    const listElement = game === 'poe' ? patchNoteListPoe : patchNoteListPoe2;
    if (!listElement) return;

    updateMoreButton(game);

    // 1. Initial Render from Cache
    const initialNotes = cachedPatchNotes[game] || [];
    if (initialNotes.length > 0) {
        renderPatchNotes(initialNotes.slice(0, patchNoteCount), game);
    } else {
        listElement.innerHTML = '<li class="loading">로딩중...</li>';
    }

    // 2. Fetch Fresh Data (Background)
    const apiGame = game === 'poe' ? 'poe1' : 'poe2';

    fetchPatchNotes(apiGame, patchNoteCount).then((fetchedNotes) => {
        // 3. Diff and Merge Logic
        const processedNotes: PatchNote[] = fetchedNotes.map((newNote) => {
            const existsInCache = initialNotes.some((cached) => cached.link === newNote.link);
            return {
                ...newNote,
                isNew: !existsInCache // Marked New if not found in previous cache
            };
        });

        // 4. Update Cache & Render
        if (processedNotes.length > 0) {
            // Simple equality check to avoid unnecessary re-renders
            if (JSON.stringify(processedNotes) !== JSON.stringify(initialNotes)) {
                cachedPatchNotes[game] = processedNotes;
                saveSetting(STORAGE_KEYS.CACHED_PATCH_NOTES, cachedPatchNotes);
                renderPatchNotes(processedNotes, game);
            }
        } else if (initialNotes.length === 0) {
            listElement.innerHTML = '<li class="empty">패치노트를 불러오지 못했습니다.</li>';
        }
    });
}

async function updateGameUI(game: GameType) {
    selectedGame = game;
    const config = GAME_CONFIG[game];

    // Background & Theme
    document.body.classList.remove('bg-poe', 'bg-poe2');
    document.body.classList.add(config.bgClass);

    // Theme Colors (SWR)
    const cached = cachedThemeColors[config.bgImage];
    if (cached) {
        applyThemeColors(cached);
    }

    // Always fetch/re-calculate in background to handle updates
    extractThemeColors(config.bgImage, config.fallback)
        .then((newColors) => {
            // Compare new vs cached to decide if update needed
            // Simple JSON stringify comparison
            if (!cached || JSON.stringify(newColors) !== JSON.stringify(cached)) {
                applyThemeColors(newColors);
                cachedThemeColors[config.bgImage] = newColors;
                saveSetting(STORAGE_KEYS.CACHED_THEME_COLORS, cachedThemeColors);
            }
        })
        .catch(() => {
            // Only apply fallback if no cache existed
            if (!cached) {
                applyThemeColors(config.fallback);
            }
        });

    // Logos
    if (game === 'poe') {
        logoPoe.classList.remove('inactive');
        logoPoe2.classList.add('inactive');
    } else {
        logoPoe.classList.add('inactive');
        logoPoe2.classList.remove('inactive');
    }

    // URL & Buttons
    launchBtn.dataset.url = config.url;
    if (btnHomepage) btnHomepage.href = config.homepageUrl;
    if (btnTrade) btnTrade.href = config.tradeUrl;

    if (btnTrade) btnTrade.href = config.tradeUrl;

    // Patch List Visibility
    if (patchNoteListPoe && patchNoteListPoe2) {
        if (game === 'poe') {
            patchNoteListPoe.style.display = 'block';
            patchNoteListPoe2.style.display = 'none';
        } else {
            patchNoteListPoe.style.display = 'none';
            patchNoteListPoe2.style.display = 'block';
        }
    }

    // Notices (Stale-While-Revalidate)
    // 1. Render Cached
    renderNotices(cachedNotices, game);

    // 2. Fetch & Update if changed
    fetchNotices().then((newNotices) => {
        // Simple equality check by stringify
        const isChanged = JSON.stringify(newNotices) !== JSON.stringify(cachedNotices);

        if (isChanged && newNotices.length > 0) {
            cachedNotices = newNotices;
            saveSetting(STORAGE_KEYS.CACHED_NOTICES, newNotices);
            renderNotices(newNotices, game);
        }
    });

    // Update Patch Notes
    updatePatchNotes(game);
}

function switchTab(targetTab: 'patchNotes' | 'settings' | 'help') {
    // 1. Identify current state
    const isPatchNotesActive = tabPanelPatchNotes.classList.contains('active');
    const isSettingsActive = tabPanelSettings.classList.contains('active');
    const isHelpActive = tabPanelHelp.classList.contains('active');

    // 2. Check if we are closing the current tab (Fold)
    if (
        (targetTab === 'patchNotes' && isPatchNotesActive) ||
        (targetTab === 'settings' && isSettingsActive) ||
        (targetTab === 'help' && isHelpActive)
    ) {
        // Close everything
        tabPanelPatchNotes.classList.remove('active');
        tabPanelSettings.classList.remove('active');
        tabPanelHelp.classList.remove('active');
        tabBtnPatchNotes.classList.remove('active');
        tabBtnSettings.classList.remove('active');
        tabBtnHelp.classList.remove('active');
        return;
    }

    // 3. Switching or Opening Logic
    // Reset all first (Triggers exit change for active one)
    tabPanelPatchNotes.classList.remove('active');
    tabPanelSettings.classList.remove('active');
    tabPanelHelp.classList.remove('active');
    tabBtnPatchNotes.classList.remove('active');
    tabBtnSettings.classList.remove('active');
    tabBtnHelp.classList.remove('active');

    // Activate Target (Triggers enter animation)
    if (targetTab === 'patchNotes') {
        tabPanelPatchNotes.classList.add('active');
        tabBtnPatchNotes.classList.add('active');
    } else if (targetTab === 'help') {
        tabPanelHelp.classList.add('active');
        tabBtnHelp.classList.add('active');
    } else {
        tabPanelSettings.classList.add('active');
        tabBtnSettings.classList.add('active');
    }
}

if (tabBtnPatchNotes) tabBtnPatchNotes.addEventListener('click', () => switchTab('patchNotes'));
if (tabBtnHelp) tabBtnHelp.addEventListener('click', () => switchTab('help'));
if (tabBtnSettings) tabBtnSettings.addEventListener('click', () => switchTab('settings'));

logoPoe.addEventListener('click', () => {
    if (selectedGame !== 'poe') {
        updateGameUI('poe');
        saveSetting(STORAGE_KEYS.SELECTED_GAME, 'poe');
    }
});

logoPoe2.addEventListener('click', () => {
    if (selectedGame !== 'poe2') {
        updateGameUI('poe2');
        saveSetting(STORAGE_KEYS.SELECTED_GAME, 'poe2');
    }
});

function handleSettingAction(item: SettingItem, value: any) {
    if (!item.actionId) return;

    if (item.actionId === 'togglePluginDisable') {
        updatePluginDisabledState(value);
    } else if (item.actionId === 'updatePatchNoteCount') {
        // Value is already saved via general handler, just update UI
        patchNoteCount = value;
        updatePatchNotes(selectedGame);
    }
}

function updatePluginDisabledState(isDisabled: boolean) {
    if (isDisabled) {
        document.body.classList.add('plugin-disabled');
        launchBtn.style.pointerEvents = 'none';
        launchBtn.removeAttribute('href');
        if (settingsContainer) {
            const toggle = settingsContainer.querySelector(
                `input[data-key="pluginDisable"]`
            ) as HTMLInputElement;
            if (toggle) toggle.checked = true;
        }
    } else {
        document.body.classList.remove('plugin-disabled');
        launchBtn.style.pointerEvents = 'auto';
        launchBtn.href = '#';
        if (settingsContainer) {
            const toggle = settingsContainer.querySelector(
                `input[data-key="pluginDisable"]`
            ) as HTMLInputElement;
            if (toggle) toggle.checked = false;
        }
    }
}

function renderSettings(settings: AppSettings) {
    if (!settingsContainer) return;
    settingsContainer.innerHTML = '';

    SETTINGS_CONFIG.forEach((item) => {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'control-group';
        if (item.key === 'pluginDisable') groupDiv.id = 'pluginDisableGroup';

        // 1. Label Section (Text + Tooltip)
        if (item.type === 'switch' && item.tooltip) {
            const labelContainer = document.createElement('div');
            labelContainer.className = 'label-container';

            const labelSpan = document.createElement('span');
            labelSpan.className = 'label-text';
            labelSpan.textContent = item.label;

            const tooltipWrapper = document.createElement('div');
            tooltipWrapper.className = 'tooltip-wrapper';

            const infoIcon = document.createElement('span');
            infoIcon.className = 'info-icon';
            infoIcon.textContent = 'i';

            const tooltipPopup = document.createElement('div');
            tooltipPopup.className = 'tooltip-popup';
            const tooltipImg = document.createElement('img');
            tooltipImg.src = item.tooltip.image;
            tooltipImg.alt = 'Info';

            tooltipPopup.appendChild(tooltipImg);
            tooltipWrapper.appendChild(infoIcon);
            tooltipWrapper.appendChild(tooltipPopup);

            labelContainer.appendChild(labelSpan);
            labelContainer.appendChild(tooltipWrapper);
            groupDiv.appendChild(labelContainer);
        } else {
            const labelSpan = document.createElement('span');
            labelSpan.className = 'label-text';
            labelSpan.textContent = item.label;
            groupDiv.appendChild(labelSpan);
        }

        // 2. Input Section
        if (item.type === 'switch') {
            const labelSwitch = document.createElement('label');
            labelSwitch.className = 'switch';

            const input = document.createElement('input');
            input.type = 'checkbox';
            let initialValue = settings[item.key];
            if (initialValue === undefined) initialValue = (DEFAULT_SETTINGS as any)[item.key];
            input.checked = !!initialValue;
            input.dataset.key = item.key;

            // Event Listener
            input.addEventListener('change', () => {
                const checked = input.checked;
                saveSetting(item.key, checked);
            });

            const slider = document.createElement('span');
            slider.className = 'slider round';
            if (item.styleClass) slider.classList.add(item.styleClass);

            labelSwitch.appendChild(input);
            labelSwitch.appendChild(slider);
            groupDiv.appendChild(labelSwitch);
        } else if (item.type === 'number') {
            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'setting-input-number';
            input.min = item.min.toString();
            input.max = item.max.toString();
            let initialValue = settings[item.key];
            if (initialValue === undefined) initialValue = (DEFAULT_SETTINGS as any)[item.key];
            input.value = initialValue.toString();
            input.dataset.key = item.key;

            input.addEventListener('change', () => {
                let val = parseInt(input.value);
                if (val < item.min) val = item.min;
                if (val > item.max) val = item.max;
                input.value = val.toString(); // Reset visual value if clamped

                saveSetting(item.key, val);
            });

            groupDiv.appendChild(input);
        }

        settingsContainer.appendChild(groupDiv);
    });
}

launchBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    if (document.body.classList.contains('plugin-disabled')) return;

    // Check the checkbox state directly from DOM for synchronous access

    // Simplest: Check the checkbox in DOM since it reflects current state
    const closePopupCheckbox = document.querySelector(
        `input[data-key="closePopup"]`
    ) as HTMLInputElement;
    const isClosePopupFn = closePopupCheckbox ? closePopupCheckbox.checked : false;

    const targetUrl = launchBtn.dataset.url || GAME_CONFIG.poe2.url;

    chrome.tabs.create({ url: targetUrl }, () => {
        if (isClosePopupFn) window.close();
    });
});

document.addEventListener('DOMContentLoaded', async () => {
    // Detect Browser first
    currentBrowser = await detectBrowser();

    const settings = await loadSettings();

    // 1. Initial Render of Settings
    renderSettings(settings);

    // 2. Apply initial states of special actions

    const isDisabled = settings.pluginDisable;
    updatePluginDisabledState(isDisabled);

    patchNoteCount = settings.patchNoteCount;
    cachedPatchNotes = settings.cachedPatchNotes || DEFAULT_SETTINGS.cachedPatchNotes; // Load cache
    cachedNotices = settings.cachedNotices || DEFAULT_SETTINGS.cachedNotices;
    cachedThemeColors = settings.cachedThemeColors || DEFAULT_SETTINGS.cachedThemeColors;

    updateGameUI(settings.selectedGame);
});

// Reactive Settings Listener
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace !== 'local') return;

    for (const [key, { newValue }] of Object.entries(changes)) {
        const item = SETTINGS_CONFIG.find((i) => i.key === key);
        if (item) {
            // 1. Trigger Action Side-Effects
            if (item.actionId) {
                handleSettingAction(item, newValue);
            }

            // 2. Sync UI State (if changed externally)
            if (settingsContainer) {
                const input = settingsContainer.querySelector(
                    `input[data-key="${item.key}"]`
                ) as HTMLInputElement;
                if (input) {
                    // Check if value actually differs to avoid cursor jumps or loops (though 'change' event breaks loop)
                    if (item.type === 'switch' && input.checked !== !!newValue) {
                        input.checked = !!newValue;
                    } else if (
                        item.type === 'number' &&
                        input.value !== (newValue as any).toString()
                    ) {
                        input.value = (newValue as any).toString();
                    }
                }
            }
        }
    }
});
