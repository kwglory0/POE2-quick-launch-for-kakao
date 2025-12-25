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
        // Match popup.ts logic: Default to TRUE if undefined (unless explicitly false)
        // Actually popup.ts defaults to true. content.ts should probably respect that default or just read truthiness?
        // popup.ts: result.closeTab !== false.

        isCloseTabEnabled: result[KEY_CLOSE_TAB] !== false,
        isClosePopupEnabled: result[KEY_CLOSE_POPUP] !== false,
        isPluginDisabled: result[KEY_PLUGIN_DISABLED] === true
    };

    dispatchPageLogic(settings);
});

// Listen for Hash Changes (e.g. User clicks bookmark with #autoStart while on page)
window.addEventListener('hashchange', () => {
    console.log('[Content] Hash changed:', window.location.hash);
    if (window.location.hash.includes('#autoStart')) {
        // Re-fetch settings to ensure we use the latest values (User might have toggled options)
        chrome.storage.local.get([KEY_AUTO_START, KEY_CLOSE_TAB, KEY_CLOSE_POPUP, KEY_PLUGIN_DISABLED], (result) => {
            const currentSettings: PageSettings = {
                isAutoStartEnabled: result[KEY_AUTO_START] === true,
                isCloseTabEnabled: result[KEY_CLOSE_TAB] !== false,
                isClosePopupEnabled: result[KEY_CLOSE_POPUP] !== false,
                isPluginDisabled: result[KEY_PLUGIN_DISABLED] === true
            };

            // Only trigger if we are on the Main Page
            if (window.location.pathname.includes('/main')) {
                console.log('[Content] #autoStart detected via Hash Change. Re-triggering logic with fresh settings.');
                handleMainPage(currentSettings);
            }
        });
    }
});

/**
 * Dispatches logic based on the current URL.
 */
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

/**
 * Handles logic for the POE2 Homepage (/main).
 */
function handleMainPage(settings: PageSettings) {
    console.log('Page Type: MAIN');

    const shouldDismissToday = settings.isClosePopupEnabled;
    const isAutoStart = window.location.hash.includes('#autoStart');

    // If "Always Close Popup" is on, OR we need to clear obstacles for Auto Start:
    // We launch the modal manager.
    if (shouldDismissToday || isAutoStart) {
        manageIntroModal(shouldDismissToday);
    }

    if (isAutoStart) {
        console.log('Auto Start triggered on Homepage.');
        // Delegate session storage write to Background Script (to avoid Access Denied errors)
        chrome.runtime.sendMessage({ action: 'setAutoSequence', value: true });

        // Start Game Launch Polling
        startPolling(settings);
    }
}

/**
 * Handles logic for Security Center Page (Designated PC Popup).
 */
function handleSecurityCenterPage(_settings: PageSettings) {
    console.log('Page Type: SECURITY_CENTER');

    const observer = new MutationObserver((_mutations, obs) => {
        // Structure: <a class="btn-confirm"><span class="btn-block__text">확인</span></a>
        const buttons = Array.from(document.querySelectorAll('a, button, span.btn_g, .popup__link--confirm, .btn-confirm'));

        // Priority 0: Designated PC "Confirm" Button
        const designPcBtn = buttons.find(el => el.classList.contains('btn-confirm'));
        if (designPcBtn) {
            console.log('Found Designated PC Confirm button (.btn-confirm). Clicking...');
            safeClick(designPcBtn as HTMLElement);
            // We generally want to stop after clicking, but sometimes multiple steps are needed? 
            // Usually just one confirm for the popup.
            obs.disconnect();
            return;
        }

        // Priority 1: Generic Confirm (Fallback)
        const confirmBtn = buttons.find(el => {
            return el.classList.contains('popup__link--confirm') || (el as HTMLElement).innerText?.trim() === '확인';
        });

        if (confirmBtn) {
            console.log('Found Generic Confirm button. Clicking...');
            safeClick(confirmBtn as HTMLElement);
            obs.disconnect();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

/**
 * Handles logic for Launcher / PubSvc Page (Game Start).
 */
function handleLauncherPage(settings: PageSettings) {
    console.log('Page Type: LAUNCHER / PUBSVC');

    const observer = new MutationObserver((_mutations, obs) => {
        const buttons = Array.from(document.querySelectorAll('a, button, span.btn_g, .popup__link--confirm, #gameStart, .btn-start-game'));

        // 1. Check for Login Required Popup
        if (document.body.innerText.includes('로그인이 필요한 서비스') || document.body.innerText.includes('로그인 하시겠습니까')) {
            console.log('Login required popup detected.');
            const confirmBtn = buttons.find(el =>
                el.classList.contains('popup__link--confirm') || (el as HTMLElement).innerText?.trim() === '확인'
            );

            if (confirmBtn) {
                console.log('Found "Confirm" button for Login Popup. Clicking...');
                safeClick(confirmBtn as HTMLElement);
                obs.disconnect();
            }
            return;
        }

        // 2. Check for "Game Start" Button
        const gameStartBtn = buttons.find(el => {
            // Priority: ID or Class match (Designated PC Completed Page)
            if (el.id === 'gameStart' || el.classList.contains('btn-start-game')) return true;

            // Fallback: Text match
            const text = (el as HTMLElement).innerText?.trim();
            return text === '게임시작' || text === 'GAME START';
        });

        if (gameStartBtn) {
            console.log('Launcher Game Start found. Clicking...');
            safeClick(gameStartBtn as HTMLElement);

            console.log('Launcher Game Start clicked. Sending signal to Background...');

            // Send signal regardless of Auto Close setting.
            // The Background script needs to know the task is done so it can:
            // 1. Close this Launcher tab (always)
            // 2. Decide whether to Close the Main tab OR Clean its URL (based on the flag)
            chrome.runtime.sendMessage({
                action: 'launcherGameStartClicked',
                shouldCloseMainPage: settings.isCloseTabEnabled
            }, () => {
                // We check lastError to prevent Chrome from complaining, but we intentionally ignore it.
                // The page is closing immediately, so the connection will be severed.
                // Background script has already received the signal.
                const err = chrome.runtime.lastError;
                if (err) {
                    console.log('Signal sent. (Response lost due to tab close - Expected behavior)');
                } else {
                    console.log('Signal sent successfully.');
                }
            });
            obs.disconnect();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

// =============================================================================
// Helper Functions
// =============================================================================

function startPolling(settings: PageSettings) {
    let attempts = 0;
    let modalWaitCount = 0;
    const maxAttempts = 75; // 15 seconds (200ms * 75)

    const interval = setInterval(() => {
        // Safety: Pause if page lost focus
        if (!document.hasFocus()) {
            console.log('Page lost focus, skipping click this tick.');
            return;
        }

        // 1. Modal Blocker Check (with Timeout)
        // Wait up to approx 3 seconds (15 * 200ms = 3000ms)
        if (modalWaitCount < 15) {
            const visibleModal = Array.from(document.querySelectorAll('.modal__container')).find(
                el => (el as HTMLElement).offsetParent !== null
            );

            if (visibleModal) {
                // Log less frequently to avoid spam? or just log
                if (modalWaitCount % 5 === 0) console.log(`Intro Modal detected. Waiting... (${modalWaitCount + 1}/15)`);
                modalWaitCount++;
                return; // Skip this tick
            }
        } else if (modalWaitCount === 15) {
            console.log('Modal wait timeout exceeded. Bypassing check...');
            modalWaitCount++;
        }

        attempts++;
        const startBtn = document.querySelector('.main-start__link') as HTMLElement;

        if (startBtn) {
            console.log(`[Attempt ${attempts}] Found Start Button (.main-start__link), clicking...`);
            safeClick(startBtn);

            // Click strictly ONCE
            console.log('Start Button clicked. Stopping polling immediately.');
            clearInterval(interval);

            // Send signal to background
            console.log('Sending game start signal from Main Page...');
            chrome.runtime.sendMessage({
                action: 'launcherGameStartClicked',
                // CRITICAL FIX: Only close tab if explicitly requested by 'Close Tab' setting
                // 'Always Close Popup' affects the modal, NOT the tab.
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

    // 1. Cookie Pre-emptive Strike
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
        // Strict Target based on User's HTML Snippet
        const introContent = document.getElementById('kgIntroModalContents');
        if (!introContent) {
            // console.log('kgIntroModalContents not found');
            return false;
        }

        const container = introContent.closest('.modal__container');
        if (!container) return false;

        // Check visibility (heuristic)
        if ((container as HTMLElement).offsetParent === null) return false;

        // Strategy A: "Today Close" Logic (Priority)
        if (preferTodayClose) {
            const todayBtn = container.querySelector('.modal__button-block');
            if (todayBtn) {
                console.log('Found "Today Close" button (.modal__button-block) inside target container. Clicking...');
                safeClick(todayBtn as HTMLElement);
                return true;
            } else {
                console.log('"Today Close" preferred but .modal__button-block not found in target container. Falling back to X...');
            }
        }

        // Strategy B: Click "X" (Fallback or Default)
        const closeBtn = container.querySelector('.modal__button-x');
        if (closeBtn) {
            console.log('Found "Close" button (.modal__button-x) inside target container. Clicking...');
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

/**
 * Safely clicks an element using MouseEvent.
 * Silences CSP errors by preventing default navigation for 'javascript:' hrefs.
 */
function safeClick(element: HTMLElement) {
    if (!element) return;

    const event = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true
    });

    // Strategy: If it's a 'javascript:' link, the browser blocks it anyway (CSP).
    // So we preventDefault() to stop the browser from even trying, which hides the error.
    // The actual logic (event listeners) remains unaffected and will still run.
    if (element instanceof HTMLAnchorElement && element.href.toLowerCase().startsWith('javascript:')) {
        event.preventDefault();
    }

    element.dispatchEvent(event);
}

// Global Message Listener (for Main Page actions triggering from Background)
console.log('Registering cleanupUrl listener...');
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === 'cleanupUrl') {
        console.log('[Content] Received cleanup signal. Current Hash:', window.location.hash);

        if (window.location.hash.includes('#autoStart')) {
            console.log('[Content] Removing #autoStart from URL via replaceState...');
            history.replaceState(null, '', window.location.pathname + window.location.search);

            // Double-check and force if necessary
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
