// popup.ts

// Type assertions for stronger typing
const closeTabToggle = document.getElementById('closeTabToggle') as HTMLInputElement;
const closePopupToggle = document.getElementById('closePopupToggle') as HTMLInputElement;
const pluginDisableToggle = document.getElementById('pluginDisableToggle') as HTMLInputElement;
const launchBtn = document.getElementById('launchBtn') as HTMLAnchorElement;
// Stacked Drawer Elements
const settingsToggle = document.getElementById('settingsToggle') as HTMLElement;
const settingsContent = document.getElementById('settingsContent') as HTMLElement;
const patchNotesToggle = document.getElementById('patchNotesToggle') as HTMLElement;
const patchNotesContent = document.getElementById('patchNotesContent') as HTMLElement;

// Mutual Exclusion Drawer Logic
function toggleDrawerStack(target: 'settings' | 'patchNotes') {
    const isSettingsTarget = target === 'settings';

    if (isSettingsTarget) {
        // Toggle Settings
        const willOpen = !settingsContent.classList.contains('open');
        settingsContent.classList.toggle('open', willOpen);
        settingsToggle.classList.toggle('active', willOpen);

        // Close Patch Notes
        if (willOpen) {
            patchNotesContent.classList.remove('open');
            patchNotesToggle.classList.remove('active');
        }
    } else {
        // Toggle Patch Notes
        const willOpen = !patchNotesContent.classList.contains('open');
        patchNotesContent.classList.toggle('open', willOpen);
        patchNotesToggle.classList.toggle('active', willOpen);

        // Close Settings
        if (willOpen) {
            settingsContent.classList.remove('open');
            settingsToggle.classList.remove('active');
        }
    }
}

if (settingsToggle) {
    settingsToggle.addEventListener('click', () => toggleDrawerStack('settings'));
}

if (patchNotesToggle) {
    patchNotesToggle.addEventListener('click', () => toggleDrawerStack('patchNotes'));
}

// Save settings on change
closeTabToggle.addEventListener('change', () => {
    chrome.storage.local.set({ closeTab: closeTabToggle.checked });
});

closePopupToggle.addEventListener('change', () => {
    chrome.storage.local.set({ closePopup: closePopupToggle.checked });
});

// Plugin Disable Toggle Logic
pluginDisableToggle.addEventListener('change', () => {
    const isDisabled = pluginDisableToggle.checked;
    chrome.storage.local.set({ isPluginDisabled: isDisabled });
    updatePluginDisabledState(isDisabled);
});

function updatePluginDisabledState(isDisabled: boolean) {
    if (isDisabled) {
        document.body.classList.add('plugin-disabled');
        launchBtn.style.pointerEvents = 'none'; // Disable link click
        launchBtn.removeAttribute('href');
    } else {
        document.body.classList.remove('plugin-disabled');
        launchBtn.style.pointerEvents = 'auto';
        launchBtn.href = '#'; // Restore href
    }
}

// Launch Game Button Logic
launchBtn.addEventListener('click', (e) => {
    e.preventDefault();

    if (document.body.classList.contains('plugin-disabled')) {
        return; // Do nothing if disabled
    }

    // 1. Get Settings
    // Removed unused isCloseTabFn
    const isClosePopupFn = closePopupToggle.checked;

    chrome.tabs.create({ url: 'https://pathofexile2.game.daum.net/main#autoStart' }, (tab) => {
        if (tab && tab.id) {
            // Logic handled by content scripts
        }

        // Handle "Close Popup" only after tab creation is initiated
        if (isClosePopupFn) {
            window.close();
        }
    });
});

// Load Settings on Startup
function loadSettings() {
    chrome.storage.local.get(['closeTab', 'closePopup', 'isPluginDisabled'], (result) => {
        if (result.closeTab !== undefined) {
            closeTabToggle.checked = result.closeTab as boolean;
        }
        if (result.closePopup !== undefined) {
            closePopupToggle.checked = result.closePopup as boolean;
        }
        if (result.isPluginDisabled !== undefined) {
            const isDisabled = result.isPluginDisabled as boolean;
            pluginDisableToggle.checked = isDisabled;
            // Apply initial visual state
            updatePluginDisabledState(isDisabled);
        }
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', loadSettings);
