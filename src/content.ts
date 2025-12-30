import { SELECTORS } from './domSelectors';
import { loadSettings, AppSettings } from './storage';

console.log('POE / POE2 Quick Launch Content Script Loaded');

// Entry Point
loadSettings().then((settings) => {
    dispatchPageLogic(settings);
});

// Listen for Hash Changes
window.addEventListener('hashchange', async () => {
    console.log('[Content] Hash changed:', window.location.hash);
    if (window.location.hash.includes('#autoStart')) {
        const settings = await loadSettings();

        if (window.location.pathname.includes('/main')) {
            console.log('[Content] #autoStart detected via Hash Change. Re-triggering logic with fresh settings.');
            handlePoe2Page(settings);
        }
    }
});

function dispatchPageLogic(settings: AppSettings) {
    if (settings.pluginDisable) {
        console.log('Plugin is disabled by user setting. Skipping all logic.');
        return;
    }

    const path = window.location.pathname;
    const hostname = window.location.hostname;

    console.log('Dispatching logic for:', window.location.href);

    if (hostname.includes('poe.game.daum.net')) {
        handlePoePage(settings);
    }
    else if (hostname.includes('pathofexile2.game.daum.net') && path.includes('/main')) {
        handlePoe2Page(settings);
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

function handlePoePage(settings: AppSettings) {
    console.log('Page Type: POE MAIN');

    if (window.location.hash.includes('#autoStart')) {
        console.log('Auto Start triggered on POE.');

        const pollForButton = setInterval(() => {
            const startBtn = document.querySelector(SELECTORS.POE.BTN_GAME_START) as HTMLElement;
            if (startBtn) {
                console.log('Found POE Start Button, clicking...');
                safeClick(startBtn);
                clearInterval(pollForButton);

                // Send signal to potentially close tab if configured (reuse launcher signal)
                chrome.runtime.sendMessage({
                    action: 'launcherGameStartClicked',
                    shouldCloseMainPage: settings.closeTab
                });
            }
        }, 500);

        // Timeout after 10 seconds
        setTimeout(() => clearInterval(pollForButton), 10000);
    }
}

function handlePoe2Page(settings: AppSettings) {
    console.log('Page Type: POE2 MAIN');

    const shouldDismissToday = settings.closePopup;
    const isAutoStart = window.location.hash.includes('#autoStart');

    // Modal Logic:
    // 1. Always Close = True -> Try "Today Close" (ignoring #autoStart)
    // 2. Always Close = False + #autoStart -> Try "Close" (X button)
    if (shouldDismissToday || isAutoStart) {
        manageIntroModal(shouldDismissToday); // Pass true if we prefer "Today Close"
    }

    if (isAutoStart) {
        console.log('Auto Start triggered on Homepage.');
        chrome.runtime.sendMessage({ action: 'setAutoSequence', value: true });
        startPolling(settings);
    }
}

function handleSecurityCenterPage(_settings: AppSettings) {
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

function handleLauncherPage(settings: AppSettings) {
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
                shouldCloseMainPage: settings.closeTab
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

function startPolling(settings: AppSettings) {
    let attempts = 0;
    const maxAttempts = 75; // 15 seconds (200ms * 75)

    const interval = setInterval(() => {
        // Removed document.hasFocus() check to ensure background execution works

        // 1. Modal Blocker Check (REMOVED)

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
                shouldCloseMainPage: settings.closeTab
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
    // Check for existing cookie first to avoid redundant operations and potential site errors
    if (document.cookie.includes('POE2_INTRO_MODAL=1')) {
        console.log('Intro Modal cookie already present. Skipping modal logic.');
        return;
    }

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

        // Strategy A: "Today Close" Logic (Only if preferred)
        if (preferTodayClose) {
            const todayBtn = container.querySelector(SELECTORS.MAIN.BTN_TODAY_CLOSE);
            if (todayBtn) {
                console.log('Found "Today Close" button. Clicking...');
                safeClick(todayBtn as HTMLElement);
                return true;
            } else {
                console.log('"Today Close" preferred but button not found. Trying invalid fallback? No, sticking to X.');
            }
        }

        // Strategy B: Click "X" (Default or Fallback)
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

    // 1. 특수 링크 감지 (javascript:...)
    // 'javascript:'로 시작하는 링크를 직접 click()하면 CSP(보안 정책)에 의해 차단될 수 있습니다.
    // 따라서 마우스 이벤트를 직접 생성하여 디스패치하는 우회 방법을 사용합니다.
    if (element instanceof HTMLAnchorElement && element.href.toLowerCase().startsWith('javascript:')) {
        const event = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true
        });
        event.preventDefault(); // 중요: 브라우저의 기본 이동 동작을 막고, 스크립트만 실행되도록 합니다.
        element.dispatchEvent(event);
        return;
    }

    // 2. 일반 요소 (Button, Div 등)
    // 호환성이 가장 좋은 표준 .click() 메서드를 사용합니다. (Native Click)
    if (typeof element.click === 'function') {
        element.click();
        return;
    }

    // 3. 최후의 수단 (Fallback)
    // click() 함수가 없는 일부 요소(SVG 등)를 위해 강제로 마우스 이벤트를 발생시킵니다.
    const event = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true
    });
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
