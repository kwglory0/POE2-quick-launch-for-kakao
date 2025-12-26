import { SELECTORS } from './domSelectors';

// Storage Keys (Must match popup.ts)
const KEY_AUTO_START = 'autoStartEnabled'; // Unused legacy?
const KEY_CLOSE_TAB = 'closeTab';
const KEY_CLOSE_POPUP = 'closePopup';
const KEY_PLUGIN_DISABLED = 'isPluginDisabled';

interface PageSettings {
    isAutoStartEnabled: boolean;
    isCloseTabEnabled: boolean;
    isClosePopupEnabled: boolean;
    isPluginDisabled: boolean;
}

console.log('POE2 Quick Launch Content Script Loaded');

// Entry Point
chrome.storage.local.get([KEY_AUTO_START, KEY_CLOSE_TAB, KEY_CLOSE_POPUP, KEY_PLUGIN_DISABLED], (result) => {
    const settings: PageSettings = {
        isAutoStartEnabled: result[KEY_AUTO_START] === true,
        isCloseTabEnabled: result[KEY_CLOSE_TAB] !== false,
        isClosePopupEnabled: result[KEY_CLOSE_POPUP] !== false,
        isPluginDisabled: result[KEY_PLUGIN_DISABLED] === true
    };

    dispatchPageLogic(settings);
});

// Listen for Hash Changes
window.addEventListener('hashchange', () => {
    console.log('[Content] Hash changed:', window.location.hash);
    if (window.location.hash.includes('#autoStart')) {
        chrome.storage.local.get([KEY_AUTO_START, KEY_CLOSE_TAB, KEY_CLOSE_POPUP, KEY_PLUGIN_DISABLED], (result) => {
            const currentSettings: PageSettings = {
                isAutoStartEnabled: result[KEY_AUTO_START] === true,
                isCloseTabEnabled: result[KEY_CLOSE_TAB] !== false,
                isClosePopupEnabled: result[KEY_CLOSE_POPUP] !== false,
                isPluginDisabled: result[KEY_PLUGIN_DISABLED] === true
            };

            if (window.location.pathname.includes('/main')) {
                console.log('[Content] #autoStart detected via Hash Change. Re-triggering logic with fresh settings.');
                handleMainPage(currentSettings);
            }
        });
    }
});

function dispatchPageLogic(settings: PageSettings) {
    if (settings.isPluginDisabled) {
        console.log('Plugin is disabled by user setting. Skipping all logic.');
        return;
    }

    const path = window.location.pathname;
    const hostname = window.location.hostname;

    console.log('Dispatching logic for:', window.location.href);

    if (path.includes('/main')) {
        handleMainPage(settings);
    }
    else if (hostname.includes('security-center')) {
        handleSecurityCenterPage(settings);
    }
    else if (path.includes('gamestart') || hostname.includes('pubsvc')) {
        handleLauncherPage(settings);
    }
    else {
        console.log(`No specific logic for this page type. {path: ${path}, hostname: ${hostname}}`);
    }
}

function handleMainPage(settings: PageSettings) {
    console.log('Page Type: MAIN');

    const shouldDismissToday = settings.isClosePopupEnabled;
    const isAutoStart = window.location.hash.includes('#autoStart');

    if (shouldDismissToday || isAutoStart) {
        manageIntroModal(shouldDismissToday);
    }

    if (isAutoStart) {
        console.log('Auto Start triggered on Homepage.');
        chrome.runtime.sendMessage({ action: 'setAutoSequence', value: true });
        startPolling(settings);
    }
}

function handleSecurityCenterPage(_settings: PageSettings) {
    console.log('Page Type: SECURITY_CENTER');

    const checkAndClick = (obs?: MutationObserver) => {
        const buttons = Array.from(document.querySelectorAll(SELECTORS.SECURITY.CONFIRM_BUTTONS.join(', ')));

        // Priority 0: Designated PC "Confirm" Button
        const designPcBtn = buttons.find(el => el.classList.contains(SELECTORS.SECURITY.BTN_DESIGNATED_CONFIRM.substring(1))); // remove dot for check
        if (designPcBtn) {
            console.log('Found Designated PC Confirm button. Clicking...');
            safeClick(designPcBtn as HTMLElement);
            if (obs) obs.disconnect();
            return true;
        }

        // Priority 1: Generic Confirm (Fallback)
        const confirmBtn = buttons.find(el => {
            return el.classList.contains(SELECTORS.SECURITY.BTN_POPUP_CONFIRM.substring(1)) || (el as HTMLElement).innerText?.trim() === '확인';
        });

        if (confirmBtn) {
            console.log('Found Generic Confirm button. Clicking...');
            safeClick(confirmBtn as HTMLElement);
            if (obs) obs.disconnect();
            return true;
        }
        return false;
    };

    if (!checkAndClick()) {
        const observer = new MutationObserver((_mutations, obs) => {
            checkAndClick(obs);
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
}

function handleLauncherPage(settings: PageSettings) {
    console.log('Page Type: LAUNCHER / PUBSVC');

    const checkAndClick = (obs?: MutationObserver) => {
        // Construct query string from array
        const query = SELECTORS.LAUNCHER.GAME_START_BUTTONS.join(', ');
        const buttons = Array.from(document.querySelectorAll(query + ', .popup__link--confirm'));

        // 1. Check for Login Required Popup
        if (SELECTORS.LAUNCHER.LOGIN_REQUIRED_TEXTS.some(text => document.body.innerText.includes(text))) {
            console.log('Login required popup detected.');
            const confirmBtn = buttons.find(el =>
                el.classList.contains(SELECTORS.LAUNCHER.BTN_CONFIRM.substring(1)) || (el as HTMLElement).innerText?.trim() === '확인'
            );

            if (confirmBtn) {
                console.log('Found "Confirm" button for Login Popup. Clicking...');
                safeClick(confirmBtn as HTMLElement);
                if (obs) obs.disconnect();
                return true;
            }
            return false;
        }

        // 2. Check for "Game Start" Button
        const gameStartBtn = buttons.find(el => {
            if (el.id === 'gameStart' || el.classList.contains('btn-start-game')) return true;
            const text = (el as HTMLElement).innerText?.trim();
            return text === '게임시작' || text === 'GAME START';
        });

        if (gameStartBtn) {
            console.log('Launcher Game Start found. Clicking...');
            safeClick(gameStartBtn as HTMLElement);

            console.log('Launcher Game Start clicked. Sending signal to Background...');
            chrome.runtime.sendMessage({
                action: 'launcherGameStartClicked',
                shouldCloseMainPage: settings.isCloseTabEnabled
            }, () => {
                const err = chrome.runtime.lastError;
                if (err) {
                    console.log('Signal sent. (Response lost due to tab close - Expected behavior)');
                } else {
                    console.log('Signal sent successfully.');
                }
            });
            if (obs) obs.disconnect();
            return true;
        }
        return false;
    };

    // Attempt immediately
    if (!checkAndClick()) {
        console.log('Loop not found immediately. Starting observer...');
        const observer = new MutationObserver((_mutations, obs) => {
            checkAndClick(obs);
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
}

function startPolling(settings: PageSettings) {
    let attempts = 0;
    let modalWaitCount = 0;
    const maxAttempts = 75; // 15 seconds (200ms * 75)

    const interval = setInterval(() => {
        if (!document.hasFocus()) {
            console.log('Page lost focus, skipping click this tick.');
            return;
        }

        // 1. Modal Blocker Check
        if (modalWaitCount < 15) {
            const visibleModal = Array.from(document.querySelectorAll(SELECTORS.MAIN.MODAL_CONTAINER)).find(
                el => (el as HTMLElement).offsetParent !== null
            );

            if (visibleModal) {
                if (modalWaitCount % 5 === 0) console.log(`Intro Modal detected. Waiting... (${modalWaitCount + 1}/15)`);
                modalWaitCount++;
                return;
            }
        } else if (modalWaitCount === 15) {
            console.log('Modal wait timeout exceeded. Bypassing check...');
            modalWaitCount++;
        }

        attempts++;
        const startBtn = document.querySelector(SELECTORS.MAIN.BTN_GAME_START) as HTMLElement;

        if (startBtn) {
            console.log(`[Attempt ${attempts}] Found Start Button, clicking...`);
            safeClick(startBtn);

            console.log('Start Button clicked. Stopping polling immediately.');
            clearInterval(interval);

            console.log('Sending game start signal from Main Page...');
            chrome.runtime.sendMessage({
                action: 'launcherGameStartClicked',
                shouldCloseMainPage: settings.isCloseTabEnabled
            }, () => {
                const err = chrome.runtime.lastError;
                if (err) console.log('Main Page Signal sent (safely ignored error).');
                else console.log('Main Page Signal sent successfully.');
            });

            return;
        } else {
            if (attempts % 5 === 0) console.log(`[Attempt ${attempts}] Start Button not found yet.`);
        }

        if (attempts >= maxAttempts) {
            clearInterval(interval);
            console.log('Stopped polling for Start Button.');
        }
    }, 200);
}

function manageIntroModal(preferTodayClose: boolean) {
    console.log(`Managing Intro Modal. Prefer 'Today Close': ${preferTodayClose}`);

    if (preferTodayClose) {
        try {
            if (!document.cookie.includes('POE2_INTRO_MODAL=1')) {
                document.cookie = "POE2_INTRO_MODAL=1; path=/; max-age=86400";
                console.log('Set POE2_INTRO_MODAL=1 cookie.');
            }
        } catch (e) {
            console.warn('Cookie write failed:', e);
        }
    }

    const dismissAttempt = () => {
        const introContent = document.getElementById(SELECTORS.MAIN.INTRO_MODAL_ID);
        if (!introContent) return false;

        const container = introContent.closest(SELECTORS.MAIN.MODAL_CONTAINER);
        if (!container) return false;

        if ((container as HTMLElement).offsetParent === null) return false;

        // Strategy A: "Today Close" Logic
        if (preferTodayClose) {
            const todayBtn = container.querySelector(SELECTORS.MAIN.BTN_TODAY_CLOSE);
            if (todayBtn) {
                console.log('Found "Today Close" button. Clicking...');
                safeClick(todayBtn as HTMLElement);
                return true;
            } else {
                console.log('"Today Close" preferred but button not found. Falling back to X...');
            }
        }

        // Strategy B: Click "X" (Fallback)
        const closeBtn = container.querySelector(SELECTORS.MAIN.BTN_CLOSE_X);
        if (closeBtn) {
            console.log('Found "Close" button (X). Clicking...');
            safeClick(closeBtn as HTMLElement);
            return true;
        }

        return false;
    };

    if (dismissAttempt()) return;

    const interval = setInterval(() => {
        if (dismissAttempt()) {
            clearInterval(interval);
        }
    }, 200);

    setTimeout(() => clearInterval(interval), 10000);
}

function safeClick(element: HTMLElement) {
    if (!element) return;

    const event = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true
    });

    if (element instanceof HTMLAnchorElement && element.href.toLowerCase().startsWith('javascript:')) {
        event.preventDefault();
    }

    element.dispatchEvent(event);
}

console.log('Registering cleanupUrl listener...');
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === 'cleanupUrl') {
        console.log('[Content] Received cleanup signal. Current Hash:', window.location.hash);

        if (window.location.hash.includes('#autoStart')) {
            console.log('[Content] Removing #autoStart from URL via replaceState...');
            history.replaceState(null, '', window.location.pathname + window.location.search);

            setTimeout(() => {
                if (window.location.hash.includes('autoStart')) {
                    console.log('[Content] replaceState failed? Forcing window.location.hash clear.');
                    window.location.hash = '';
                } else {
                    console.log('[Content] URL Cleanup Confirmed. Hash is clean.');
                }
            }, 50);
        }
        sendResponse('cleaned');
    }
});

export { };
