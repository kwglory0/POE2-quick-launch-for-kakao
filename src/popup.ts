// DOM Elements
const launchBtn = document.getElementById('launchBtn') as HTMLButtonElement;
const closeTabCheckbox = document.getElementById('closeTabEnabled') as HTMLInputElement;
const autoClosePopupCheckbox = document.getElementById('autoClosePopup') as HTMLInputElement;

// Storage Keys
const KEY_CLOSE_TAB = 'closeTabEnabled';
const KEY_CLOSE_POPUP = 'closePopupEnabled';

// Load settings
chrome.storage.local.get([KEY_CLOSE_TAB, KEY_CLOSE_POPUP], (result) => {
    if (closeTabCheckbox) {
        closeTabCheckbox.checked = result[KEY_CLOSE_TAB] === true;
    }
    if (autoClosePopupCheckbox) {
        autoClosePopupCheckbox.checked = result[KEY_CLOSE_POPUP] === true;
    }
});

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

// Launch Button Logic
if (launchBtn) {
    launchBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: 'https://pathofexile2.game.daum.net/main#autoStart' });
    });
}
