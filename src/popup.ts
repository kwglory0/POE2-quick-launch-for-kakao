// popup.ts
import { loadSettings, saveSetting, STORAGE_KEYS, GameType, PatchNote, DEFAULT_SETTINGS, Notice, ThemeColors } from './storage';
import { fetchPatchNotes, getPatchNoteUrl } from './patch-notes';
import { fetchNotices } from './notice';

// Type assertions for stronger typing
const closeTabToggle = document.getElementById('closeTabToggle') as HTMLInputElement;
const closePopupToggle = document.getElementById('closePopupToggle') as HTMLInputElement;
const showNoticesToggle = document.getElementById('showNoticesToggle') as HTMLInputElement;
const pluginDisableToggle = document.getElementById('pluginDisableToggle') as HTMLInputElement;
const launchBtn = document.getElementById('launchBtn') as HTMLAnchorElement;
const noticeContainer = document.getElementById('noticeContainer') as HTMLDivElement;
const btnHomepage = document.getElementById('btnHomepage') as HTMLAnchorElement;
const btnTrade = document.getElementById('btnTrade') as HTMLAnchorElement;

// Patch Note Elements
const patchNoteListPoe = document.getElementById('patchNoteList-poe') as HTMLUListElement;
const patchNoteListPoe2 = document.getElementById('patchNoteList-poe2') as HTMLUListElement;
const patchNoteMoreBtn = document.getElementById('patchNoteMoreBtn') as HTMLAnchorElement;
const patchNoteCountInput = document.getElementById('patchNoteCountInput') as HTMLInputElement;

// Game Switcher Elements
const logoPoe = document.getElementById('logoPoe') as HTMLImageElement;
const logoPoe2 = document.getElementById('logoPoe2') as HTMLImageElement;

// Tab Elements
const tabBtnPatchNotes = document.getElementById('tabBtnPatchNotes') as HTMLButtonElement;
const tabBtnSettings = document.getElementById('tabBtnSettings') as HTMLButtonElement;
const tabPanelPatchNotes = document.getElementById('tabPanelPatchNotes') as HTMLDivElement;
const tabPanelSettings = document.getElementById('tabPanelSettings') as HTMLDivElement;

let selectedGame: GameType = 'poe2'; // Default local state, will be updated from storage
let patchNoteCount = 3;
let cachedPatchNotes: Record<GameType, PatchNote[]> = { poe: [], poe2: [] };
let cachedNotices: Notice[] = [];
let cachedThemeColors: Record<string, ThemeColors> = {};

import bgPoe from './assets/poe/bg-keepers.png';
import bgPoe2 from './assets/poe2/bg-forest.webp';

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
            footer: '#1a1510'   // Dark Brown/Black
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
            footer: '#0c150c'  // Dark Green
        }
    }
};

// ... Color Utils (Keep reused logic, omitted for brevity if unchanged, but included here for completeness) ...
function rgbToHsl(r: number, g: number, b: number) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0; // achromatic
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h * 360, s, l];
}

function hslToHex(h: number, s: number, l: number) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

async function extractThemeColors(imageUrl: string, fallback: { text: string, accent: string, footer: string }): Promise<{ text: string, accent: string, footer: string }> {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = imageUrl;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(fallback);

            canvas.width = 1;
            canvas.height = 1;
            ctx.drawImage(img, 0, 0, 1, 1);
            const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;

            let [h, s, l] = rgbToHsl(r, g, b);

            const accentS = Math.max(s * 100, 50);
            const accentL = Math.max(Math.min(l * 100 * 1.5, 80), 60);
            const accent = hslToHex(h, accentS, accentL);

            const textS = Math.min(s * 100, 20);
            const textL = 90;
            const text = hslToHex(h, textS, textL);

            const footerS = Math.min(s * 100, 20);
            const footerL = 8;
            const footer = hslToHex(h, footerS, footerL);

            resolve({ text, accent, footer });
        };
        img.onerror = () => {
            console.warn('Failed to load bg image, using fallback:', imageUrl);
            resolve(fallback);
        };
    });
}

function applyThemeColors(colors: ThemeColors) {
    document.body.style.setProperty('--theme-text', colors.text);
    document.body.style.setProperty('--theme-accent', colors.accent);
    document.body.style.setProperty('--theme-footer-bg', colors.footer);
}

function updateMoreButton(game: GameType) {
    if (patchNoteMoreBtn) {
        const apiGame = game === 'poe' ? 'poe1' : 'poe2';
        patchNoteMoreBtn.href = getPatchNoteUrl(apiGame);
    }
}

function renderNotices(notices: Notice[], game: GameType) {
    if (!noticeContainer) return;
    noticeContainer.innerHTML = '';

    const currentNotices = notices.filter(n => n.targetGame.includes(game));

    currentNotices.forEach(notice => {
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

    notes.forEach(note => {
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

    fetchPatchNotes(apiGame, patchNoteCount).then(fetchedNotes => {
        // 3. Diff and Merge Logic
        const processedNotes: PatchNote[] = fetchedNotes.map(newNote => {
            const existsInCache = initialNotes.some(cached => cached.link === newNote.link);
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
    extractThemeColors(config.bgImage, config.fallback).then(newColors => {
        // Compare new vs cached to decide if update needed
        // Simple JSON stringify comparison
        if (!cached || JSON.stringify(newColors) !== JSON.stringify(cached)) {
            applyThemeColors(newColors);
            cachedThemeColors[config.bgImage] = newColors;
            saveSetting(STORAGE_KEYS.CACHED_THEME_COLORS, cachedThemeColors);
        }
    }).catch(() => {
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
    fetchNotices().then(newNotices => {
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



// function switchTab(tab: 'patchNotes' | 'settings') {
//     const isPatchNotesActive = tabBtnPatchNotes.classList.contains('active');
//     const isSettingsActive = tabBtnSettings.classList.contains('active');

//     // Case 1: Clicking the already active tab -> Toggle Collapse
//     if ((tab === 'patchNotes' && isPatchNotesActive) || (tab === 'settings' && isSettingsActive)) {
//         tabContentContainer.classList.toggle('collapsed');
//         // Optional: Toggle active state of button to reflect 'closed'? 
//         // User requested "fold/unfold", keeping button active lets them know which tab *would* be open.
//         // But to look "closed", maybe we should remove active highlight?
//         // Let's keep one tab logically "selected" but visually dim if collapsed?
//         // Actually, previous behavior was removing 'active' class from handle.
//         if (tabContentContainer.classList.contains('collapsed')) {
//             if (tab === 'patchNotes') tabBtnPatchNotes.classList.remove('active');
//             if (tab === 'settings') tabBtnSettings.classList.remove('active');
//         } else {
//             if (tab === 'patchNotes') tabBtnPatchNotes.classList.add('active');
//             if (tab === 'settings') tabBtnSettings.classList.add('active');
//         }
//         return;
//     }

//     // Case 2: Switching Tabs -> Always Open
//     tabContentContainer.classList.remove('collapsed');

//     if (tab === 'patchNotes') {
//         tabBtnPatchNotes.classList.add('active');
//         tabBtnSettings.classList.remove('active');
//         tabPanelPatchNotes.classList.add('active');
//         tabPanelSettings.classList.remove('active');
//     } else {
//         tabBtnSettings.classList.add('active');
//         tabBtnPatchNotes.classList.remove('active');
//         tabPanelSettings.classList.add('active');
//         tabPanelPatchNotes.classList.remove('active');
//     }
// }

function switchTab(targetTab: 'patchNotes' | 'settings') {
    // 1. Identify current state
    const isPatchNotesActive = tabPanelPatchNotes.classList.contains('active');
    const isSettingsActive = tabPanelSettings.classList.contains('active');

    // 2. Check if we are closing the current tab (Fold)
    if ((targetTab === 'patchNotes' && isPatchNotesActive) || (targetTab === 'settings' && isSettingsActive)) {
        // Close everything
        tabPanelPatchNotes.classList.remove('active');
        tabPanelSettings.classList.remove('active');
        tabBtnPatchNotes.classList.remove('active');
        tabBtnSettings.classList.remove('active');
        return;
    }

    // 3. Switching or Opening Logic
    // Reset all first (Triggers exit change for active one)
    tabPanelPatchNotes.classList.remove('active');
    tabPanelSettings.classList.remove('active');
    tabBtnPatchNotes.classList.remove('active');
    tabBtnSettings.classList.remove('active');

    // Activate Target (Triggers enter animation)
    if (targetTab === 'patchNotes') {
        tabPanelPatchNotes.classList.add('active');
        tabBtnPatchNotes.classList.add('active');
    } else {
        tabPanelSettings.classList.add('active');
        tabBtnSettings.classList.add('active');
    }
}

if (tabBtnPatchNotes) tabBtnPatchNotes.addEventListener('click', () => switchTab('patchNotes'));
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

closeTabToggle.addEventListener('change', () => {
    saveSetting(STORAGE_KEYS.CLOSE_TAB, closeTabToggle.checked);
});

closePopupToggle.addEventListener('change', () => {
    saveSetting(STORAGE_KEYS.CLOSE_POPUP, closePopupToggle.checked);
});

showNoticesToggle.addEventListener('change', () => {
    const isShown = showNoticesToggle.checked;
    saveSetting(STORAGE_KEYS.SHOW_NOTICES, isShown);
    if (noticeContainer) {
        noticeContainer.style.display = isShown ? 'flex' : 'none';
    }
});

pluginDisableToggle.addEventListener('change', () => {
    const isDisabled = pluginDisableToggle.checked;
    saveSetting(STORAGE_KEYS.PLUGIN_DISABLED, isDisabled);
    updatePluginDisabledState(isDisabled);
});

patchNoteCountInput.addEventListener('change', () => {
    let val = parseInt(patchNoteCountInput.value);
    if (val < 1) val = 1;
    if (val > 20) val = 20;
    patchNoteCountInput.value = val.toString();

    patchNoteCount = val;
    saveSetting(STORAGE_KEYS.PATCH_NOTE_COUNT, val);
    updatePatchNotes(selectedGame);
});

function updatePluginDisabledState(isDisabled: boolean) {
    if (isDisabled) {
        document.body.classList.add('plugin-disabled');
        launchBtn.style.pointerEvents = 'none';
        launchBtn.removeAttribute('href');
        // Homepage & Trade links should remain active
    } else {
        document.body.classList.remove('plugin-disabled');
        launchBtn.style.pointerEvents = 'auto';
        launchBtn.href = '#';
        // Homepage & Trade links remain active
    }
}

launchBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (document.body.classList.contains('plugin-disabled')) return;

    const isClosePopupFn = closePopupToggle.checked;
    const targetUrl = launchBtn.dataset.url || GAME_CONFIG.poe2.url;

    chrome.tabs.create({ url: targetUrl }, () => {
        if (isClosePopupFn) window.close();
    });
});

document.addEventListener('DOMContentLoaded', async () => {
    const settings = await loadSettings();

    closeTabToggle.checked = settings.closeTab;
    closePopupToggle.checked = settings.closePopup;
    showNoticesToggle.checked = settings.showNotices;

    // Apply visibility immediately
    if (noticeContainer) {
        noticeContainer.style.display = settings.showNotices ? 'flex' : 'none';
    }

    const isDisabled = settings.pluginDisable;
    pluginDisableToggle.checked = isDisabled;
    updatePluginDisabledState(isDisabled);

    patchNoteCount = settings.patchNoteCount;
    patchNoteCountInput.value = patchNoteCount.toString();
    cachedPatchNotes = settings.cachedPatchNotes || DEFAULT_SETTINGS.cachedPatchNotes; // Load cache
    cachedNotices = settings.cachedNotices || DEFAULT_SETTINGS.cachedNotices;
    cachedThemeColors = settings.cachedThemeColors || DEFAULT_SETTINGS.cachedThemeColors;

    updateGameUI(settings.selectedGame);
});
