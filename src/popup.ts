// popup.ts
import { loadSettings, saveSetting, STORAGE_KEYS, GameType, PatchNote, DEFAULT_SETTINGS } from './storage';
import { fetchPatchNotes, getPatchNoteUrl } from './patch-notes';

// Type assertions for stronger typing
const closeTabToggle = document.getElementById('closeTabToggle') as HTMLInputElement;
const closePopupToggle = document.getElementById('closePopupToggle') as HTMLInputElement;
const pluginDisableToggle = document.getElementById('pluginDisableToggle') as HTMLInputElement;
const launchBtn = document.getElementById('launchBtn') as HTMLAnchorElement;
const fixGuideBtn = document.getElementById('fixGuideBtn') as HTMLAnchorElement;
const btnHomepage = document.getElementById('btnHomepage') as HTMLAnchorElement;
const btnTrade = document.getElementById('btnTrade') as HTMLAnchorElement;

// Patch Note Elements
const patchNoteList = document.getElementById('patchNoteList') as HTMLUListElement;
const patchNoteMoreBtn = document.getElementById('patchNoteMoreBtn') as HTMLAnchorElement;
const patchNoteCountInput = document.getElementById('patchNoteCountInput') as HTMLInputElement;

// Game Switcher Elements
const logoPoe = document.getElementById('logoPoe') as HTMLImageElement;
const logoPoe2 = document.getElementById('logoPoe2') as HTMLImageElement;

// Stacked Drawer Elements
const settingsToggle = document.getElementById('settingsToggle') as HTMLElement;
const settingsContent = document.getElementById('settingsContent') as HTMLElement;
const patchNotesToggle = document.getElementById('patchNotesToggle') as HTMLElement;
const patchNotesContent = document.getElementById('patchNotesContent') as HTMLElement;

let selectedGame: GameType = 'poe2'; // Default local state, will be updated from storage
let patchNoteCount = 3;
let cachedPatchNotes: Record<GameType, PatchNote[]> = { poe: [], poe2: [] };

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
        showFixGuide: false,
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
        showFixGuide: true,
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

function updateMoreButton(game: GameType) {
    if (patchNoteMoreBtn) {
        const apiGame = game === 'poe' ? 'poe1' : 'poe2';
        patchNoteMoreBtn.href = getPatchNoteUrl(apiGame);
    }
}

function renderPatchNotes(notes: PatchNote[]) {
    if (!patchNoteList) return;

    patchNoteList.innerHTML = '';

    if (notes.length === 0) {
        patchNoteList.innerHTML = '<li class="empty">패치노트가 없습니다.</li>';
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
        patchNoteList.appendChild(li);
    });
}

async function updatePatchNotes(game: GameType) {
    if (!patchNoteList) return;

    updateMoreButton(game);

    // 1. Initial Render from Cache
    const initialNotes = cachedPatchNotes[game] || [];
    if (initialNotes.length > 0) {
        renderPatchNotes(initialNotes.slice(0, patchNoteCount));
    } else {
        patchNoteList.innerHTML = '<li class="loading">로딩중...</li>';
    }

    // 2. Fetch Fresh Data
    const apiGame = game === 'poe' ? 'poe1' : 'poe2';
    const fetchedNotes = await fetchPatchNotes(apiGame, patchNoteCount);

    // 3. Diff and Merge Logic
    // "New" = Item in fetched list BUT NOT in cached list (by link)
    // We want to preserve "isNew" status of cached items?
    // User request: "When overwriting, affix N to non-duplicated posts"
    // Interpretation: 
    // - Load previously cached list (Old Cache)
    // - Fetch new list (New Fetch)
    // - For each item in New Fetch:
    //   - If it exists in Old Cache, it is NOT new (isNew = false).
    //   - If it does NOT exist in Old Cache, it IS new (isNew = true).

    const processedNotes: PatchNote[] = fetchedNotes.map(newNote => {
        const existsInCache = initialNotes.some(cached => cached.link === newNote.link);
        return {
            ...newNote,
            isNew: !existsInCache // Marked New if not found in previous cache
        };
    });

    // 4. Update Cache & Render
    // Only update and re-render if there's actual data
    if (processedNotes.length > 0) {
        cachedPatchNotes[game] = processedNotes;
        saveSetting(STORAGE_KEYS.CACHED_PATCH_NOTES, cachedPatchNotes);
        renderPatchNotes(processedNotes);
    } else if (initialNotes.length === 0) {
        patchNoteList.innerHTML = '<li class="empty">패치노트를 불러오지 못했습니다.</li>';
    }
}

async function updateGameUI(game: GameType) {
    selectedGame = game;
    const config = GAME_CONFIG[game];

    // Background & Theme
    document.body.classList.remove('bg-poe', 'bg-poe2');
    document.body.classList.add(config.bgClass);

    try {
        const colors = await extractThemeColors(config.bgImage, config.fallback);
        document.body.style.setProperty('--theme-text', colors.text);
        document.body.style.setProperty('--theme-accent', colors.accent);
        document.body.style.setProperty('--theme-footer-bg', colors.footer);
    } catch (e) {
        document.body.style.setProperty('--theme-text', config.fallback.text);
        document.body.style.setProperty('--theme-accent', config.fallback.accent);
        document.body.style.setProperty('--theme-footer-bg', config.fallback.footer);
    }

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

    if (config.showFixGuide) {
        fixGuideBtn.style.display = 'flex';
    } else {
        fixGuideBtn.style.display = 'none';
    }

    // Update Patch Notes
    updatePatchNotes(game);
}

// ... Drawer and Event Listeners (Same as before) ...

function toggleDrawerStack(target: 'settings' | 'patchNotes') {
    const isSettingsTarget = target === 'settings';

    if (isSettingsTarget) {
        const willOpen = !settingsContent.classList.contains('open');
        settingsContent.classList.toggle('open', willOpen);
        settingsToggle.classList.toggle('active', willOpen);

        if (willOpen) {
            patchNotesContent.classList.remove('open');
            patchNotesToggle.classList.remove('active');
        }
    } else {
        const willOpen = !patchNotesContent.classList.contains('open');
        patchNotesContent.classList.toggle('open', willOpen);
        patchNotesToggle.classList.toggle('active', willOpen);

        if (willOpen) {
            settingsContent.classList.remove('open');
            settingsToggle.classList.remove('active');
        }
    }
}

if (settingsToggle) settingsToggle.addEventListener('click', () => toggleDrawerStack('settings'));
if (patchNotesToggle) patchNotesToggle.addEventListener('click', () => toggleDrawerStack('patchNotes'));

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

    const isDisabled = settings.pluginDisable;
    pluginDisableToggle.checked = isDisabled;
    updatePluginDisabledState(isDisabled);

    patchNoteCount = settings.patchNoteCount;
    patchNoteCountInput.value = patchNoteCount.toString();
    cachedPatchNotes = settings.cachedPatchNotes || DEFAULT_SETTINGS.cachedPatchNotes; // Load cache

    updateGameUI(settings.selectedGame);
});
