// DOM Elements
const launchBtn = document.getElementById('launchBtn') as HTMLButtonElement;
const closeTabCheckbox = document.getElementById('closeTabEnabled') as HTMLInputElement;
const autoClosePopupCheckbox = document.getElementById('autoClosePopup') as HTMLInputElement;
const pluginDisabledCheckbox = document.getElementById('pluginDisabled') as HTMLInputElement;

// Storage Keys
const KEY_CLOSE_TAB = 'closeTabEnabled';
const KEY_CLOSE_POPUP = 'closePopupEnabled';
const KEY_PLUGIN_DISABLED = 'pluginDisabled';

// Load settings
chrome.storage.local.get([KEY_CLOSE_TAB, KEY_CLOSE_POPUP, KEY_PLUGIN_DISABLED], (result) => {
    if (closeTabCheckbox) {
        closeTabCheckbox.checked = result[KEY_CLOSE_TAB] === true;
    }
    if (autoClosePopupCheckbox) {
        autoClosePopupCheckbox.checked = result[KEY_CLOSE_POPUP] === true;
    }
    if (pluginDisabledCheckbox) {
        const isDisabled = result[KEY_PLUGIN_DISABLED] === true;
        pluginDisabledCheckbox.checked = isDisabled;
        updateDisabledState(isDisabled);
    }
});

// Helper to update UI state
function updateDisabledState(disabled: boolean) {
    if (disabled) {
        document.body.classList.add('plugin-disabled');
    } else {
        document.body.classList.remove('plugin-disabled');
    }
}

// Save settings
if (closeTabCheckbox) {
    closeTabCheckbox.addEventListener('change', () => {
        chrome.storage.local.set({ [KEY_CLOSE_TAB]: closeTabCheckbox.checked });
    });
}

if (autoClosePopupCheckbox) {
    autoClosePopupCheckbox.addEventListener('change', () => {
        chrome.storage.local.set({ [KEY_CLOSE_POPUP]: autoClosePopupCheckbox.checked });
    });
}

if (pluginDisabledCheckbox) {
    pluginDisabledCheckbox.addEventListener('change', () => {
        const disabled = pluginDisabledCheckbox.checked;
        updateDisabledState(disabled);
        chrome.storage.local.set({ [KEY_PLUGIN_DISABLED]: disabled });
    });
}

// Launch Button Logic
if (launchBtn) {
    launchBtn.addEventListener('click', () => {
        if (pluginDisabledCheckbox && pluginDisabledCheckbox.checked) return;
        chrome.tabs.create({ url: 'https://pathofexile2.game.daum.net/main#autoStart' });
    });
}
