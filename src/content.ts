import { SELECTORS } from './domSelectors';
import { loadSettings, AppSettings } from './storage';

console.log('POE / POE2 Quick Launch Content Script Loaded');



// Listen for Hash Changes (Auto Start Re-trigger)
window.addEventListener('hashchange', async () => {
    console.log('[Content] Hash changed:', window.location.hash);
    if (window.location.hash.includes('#autoStart')) {
        const settings = await loadSettings();

        // Only POE2 Main Page re-triggering logic for now
        const currentUrl = new URL(window.location.href);
        if (Poe2MainHandler.match(currentUrl)) {
            console.log('[Content] #autoStart detected via Hash Change. Re-triggering logic.');
            Poe2MainHandler.execute(settings);
        }
    }
});

// -----------------------------------------------------------------------------
// Interface Definitions
// -----------------------------------------------------------------------------

interface PageHandler {
    name: string;
    description: string;
    match: (url: URL) => boolean;
    allowedReferrers?: string[];
    execute: (settings: AppSettings) => void;
}

// -----------------------------------------------------------------------------
// Handlers
// -----------------------------------------------------------------------------

const PoeMainHandler: PageHandler = {
    name: 'PoeMainHandler',
    description: 'POE1 Homepage - Auto Start',
    match: (url) => url.hostname === 'poe.game.daum.net',
    execute: (settings) => {
        console.log(`[Handler Execute] ${PoeMainHandler.description}`);
        if (window.location.hash.includes('#autoStart')) {
            console.log('Auto Start triggered on POE.');
            handlePoeAutoStart(settings);
        }
    }
};

const Poe2MainHandler: PageHandler = {
    name: 'Poe2MainHandler',
    description: 'POE2 Homepage - Auto Start & Modal Handling',
    match: (url) => url.hostname === 'pathofexile2.game.daum.net' && url.pathname.includes('/main'),
    execute: (settings) => {
        console.log(`[Handler Execute] ${Poe2MainHandler.description}`);
        const shouldDismissToday = settings.closePopup;
        const isAutoStart = window.location.hash.includes('#autoStart');

        if (shouldDismissToday || isAutoStart) {
            manageIntroModal(shouldDismissToday);
        }

        if (isAutoStart) {
            console.log('Auto Start triggered on Homepage.');

            // Register this tab as the Main Game Tab for later closing
            chrome.runtime.sendMessage({ action: 'registerMainTab' });

            chrome.runtime.sendMessage({ action: 'setAutoSequence', value: true });
            startPolling(settings);
        }
    }
};

const LauncherCheckHandler: PageHandler = {
    name: 'LauncherCheckHandler',
    description: 'Launcher Game Start Check & Init Page (When Not Logged In)',
    match: (url) => {
        if (url.hostname !== 'pubsvc.game.daum.net') return false;
        // Check for specific game start pages (poe.html or poe2.html)
        return url.pathname.includes('/gamestart/poe.html') || url.pathname.includes('/gamestart/poe2.html');
    },
    allowedReferrers: ['poe.game.daum.net', 'pathofexile2.game.daum.net', 'logins.daum.net', 'pubsvc.game.daum.net'],
    execute: (settings) => {
        console.log(`[Handler Execute] ${LauncherCheckHandler.description}`);
        performLauncherPageLogic(settings);
    }
};

const DaumLoginHandler: PageHandler = {
    name: 'DaumLoginHandler',
    description: 'Daum Login Check Page (When Not Logged In) - Auto Click Kakao Login',
    match: (url) => {
        if (url.hostname !== 'logins.daum.net') return false;

        // Verify 'url' parameter validates against LauncherCheckHandler logic (targets POE/POE2)
        const nextUrlParam = url.searchParams.get('url');
        if (!nextUrlParam) return false;

        try {
            const nextUrl = new URL(decodeURIComponent(nextUrlParam)); // Decoded target URL
            return nextUrl.hostname === 'pubsvc.game.daum.net' &&
                (nextUrl.pathname.includes('/gamestart/poe.html') || nextUrl.pathname.includes('/gamestart/poe2.html'));
        } catch (e) {
            return false;
        }
    },
    allowedReferrers: ['pubsvc.game.daum.net'],
    execute: (_settings) => {
        console.log(`[Handler Execute] ${DaumLoginHandler.description}`);
        const kakaoLoginBtn = document.querySelector(SELECTORS.LOGIN_DAUM.BTN_KAKAO_LOGIN);
        if (kakaoLoginBtn) {
            console.log('Found "Kakao Login" button. Clicking...');
            safeClick(kakaoLoginBtn as HTMLElement);
        }
    }
};

const KakaoManualLoginHandler: PageHandler = {
    name: 'KakaoManualLoginHandler',
    description: 'Kakao Manual Login Page (When Not Logged In) - Manual Input Required',
    match: (url) => url.hostname === 'accounts.kakao.com',
    execute: (_settings) => {
        console.log(`[Handler Execute] ${KakaoManualLoginHandler.description}`);
        console.log('User must log in manually here. Automation paused.');
    }
};

const KakaoAuthHandler: PageHandler = {
    name: 'KakaoAuthHandler',
    description: 'Kakao Auth/Continue Page (When Not Logged In) - Auto Click Agree',
    match: (url) => url.hostname === 'kauth.kakao.com' && url.pathname.includes('/oauth/authorize'),
    allowedReferrers: ['logins.daum.net', 'accounts.kakao.com'],
    execute: (_settings) => {
        console.log(`[Handler Execute] ${KakaoAuthHandler.description}`);
        const agreeBtn = document.querySelector(SELECTORS.KAKAO_AUTH.BTN_AGREE) as HTMLElement;
        if (agreeBtn) {
            console.log('Found "Agree/Continue" button. Clicking...');
            safeClick(agreeBtn);
        }
    }
};

const SecurityCenterHandler: PageHandler = {
    name: 'SecurityCenterHandler',
    description: 'Designated PC / Security Page - Auto Click Confirm',
    match: (url) => url.hostname === 'security-center.game.daum.net',
    allowedReferrers: ['pubsvc.game.daum.net', 'accounts.kakao.com', 'kauth.kakao.com'],
    execute: (_settings) => {
        console.log(`[Handler Execute] ${SecurityCenterHandler.description}`);
        performSecurityPageLogic();
    }
};

const LauncherCompletionHandler: PageHandler = {
    name: 'LauncherCompletionHandler',
    description: 'Launcher Execution Confirmation Page',
    match: (url) => {
        if (url.hostname !== 'pubsvc.game.daum.net') return false;
        if (!url.pathname.includes('/securitycenter') || !url.pathname.includes('/completed.html')) return false;

        // Verify gameCode is 'poe' or 'poe2'
        const gameCode = url.searchParams.get('gameCode');
        return gameCode === 'poe' || gameCode === 'poe2';
    },
    allowedReferrers: ['security-center.game.daum.net'],
    execute: (settings) => {
        console.log(`[Handler Execute] ${LauncherCompletionHandler.description}`);
        performLauncherPageLogic(settings);
    }
};

// Priority list (order matters)
const HANDLERS: PageHandler[] = [
    PoeMainHandler,
    Poe2MainHandler,
    LauncherCheckHandler,
    DaumLoginHandler,
    KakaoManualLoginHandler,
    KakaoAuthHandler,
    SecurityCenterHandler,
    LauncherCompletionHandler
];

// -----------------------------------------------------------------------------
// Core Dispatcher
// -----------------------------------------------------------------------------

function dispatchPageLogic(settings: AppSettings) {
    if (settings.pluginDisable) {
        console.log('Plugin is disabled by user setting. Skipping all logic.');
        return;
    }

    const currentUrl = new URL(window.location.href);
    console.log('Dispatching logic for:', currentUrl.href);
    console.log('Referrer:', document.referrer);

    for (const handler of HANDLERS) {
        if (!handler.match(currentUrl)) continue;

        console.log(`[Handler Match] ${handler.name} matched.`);

        // Referrer Validation
        if (handler.allowedReferrers) {
            const currentReferrer = document.referrer;
            // Allow empty matching if list exists but is empty (should not happen based on plan)
            // If list exists, referrer must match one of them
            const isValid = handler.allowedReferrers.some(ref => currentReferrer.includes(ref));

            if (!isValid) {
                console.warn(`[Handler Skip] ${handler.name} - Invalid Referrer: "${currentReferrer}"`);
                console.warn(`Allowed: ${JSON.stringify(handler.allowedReferrers)}`);
                return; // Stop processing since page matched but safety check failed
            }
        }

        handler.execute(settings);
        return; // Execute only the first matching handler
    }

    console.log('No matching handler found for this page.');
}

// -----------------------------------------------------------------------------
// Helper Logic
// -----------------------------------------------------------------------------

function handlePoeAutoStart(settings: AppSettings) {
    const pollForButton = setInterval(() => {
        const startBtn = document.querySelector(SELECTORS.POE.BTN_GAME_START) as HTMLElement;
        if (startBtn) {
            // Unconditional Cleanup for POE1 as well (requested generally)
            // Perform BEFORE click to ensure visual update
            history.replaceState(null, '', window.location.pathname + window.location.search);
            
            console.log('Found POE Start Button, clicking...');
            safeClick(startBtn);
            clearInterval(pollForButton);

            // Register this tab as Main Tab
            chrome.runtime.sendMessage({ action: 'registerMainTab' });

            chrome.runtime.sendMessage({
                action: 'launcherGameStartClicked',
                shouldCloseMainPage: settings.closeTab
            }, () => {
                if (chrome.runtime.lastError) { /* ignore */ }
            });
        }
    }, 500);

    setTimeout(() => clearInterval(pollForButton), 10000);
}

function performSecurityPageLogic() {
    const checkAndClick = (obs?: MutationObserver) => {
        const buttons = Array.from(document.querySelectorAll(SELECTORS.SECURITY.CONFIRM_BUTTONS.join(', ')));

        // Priority 0: Designated PC "Confirm" Button
        const designPcBtn = buttons.find(el => el.classList.contains(SELECTORS.SECURITY.BTN_DESIGNATED_CONFIRM.substring(1)));
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

function performLauncherPageLogic(settings: AppSettings) {
    const checkAndClick = (obs?: MutationObserver) => {
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

            // If this is the completion handler context (checked via path usually, but safe to send signal here if we want completion logic)
            // Actually, performLauncherPageLogic is shared.
            // But the user asked for LauncherCompletionHandler to send the signal.
            // LauncherCompletionHandler calls this function.
            // Let's check if we are in completion context to send 'closeMainTab'

            if (window.location.pathname.includes('/completed.html')) {
                console.log('Completion Page detected. Requesting to close Main Tab...');
                if (settings.closeTab) {
                    chrome.runtime.sendMessage({ action: 'closeMainTab' });
                }
            }

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
    const maxAttempts = 75; // 15 seconds

    const interval = setInterval(() => {
        attempts++;
        const startBtn = document.querySelector(SELECTORS.MAIN.BTN_GAME_START) as HTMLElement;

        if (startBtn) {
            // Unconditional Local Cleanup (User Request) - BEFORE click
            console.log('[Content] Local Cleanup: Removing #autoStart from URL (Unconditional, pre-click)...');
            history.replaceState(null, '', window.location.pathname + window.location.search);
            try {
                if (window.location.hash.includes('autoStart')) {
                     window.location.hash = '';
                }
            } catch (e) { /* ignore */ }

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

        if (preferTodayClose) {
            const todayBtn = container.querySelector(SELECTORS.MAIN.BTN_TODAY_CLOSE);
            if (todayBtn) {
                console.log('Found "Today Close" button. Clicking...');
                safeClick(todayBtn as HTMLElement);
                return true;
            }
        }

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

    if (element instanceof HTMLAnchorElement && element.href.toLowerCase().startsWith('javascript:')) {
        const event = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true
        });
        event.preventDefault();
        element.dispatchEvent(event);
        return;
    }

    if (typeof element.click === 'function') {
        element.click();
        return;
    }

    const event = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true
    });
    element.dispatchEvent(event);
}



// Entry Point
loadSettings().then((settings) => {
    dispatchPageLogic(settings);
});

export { };
