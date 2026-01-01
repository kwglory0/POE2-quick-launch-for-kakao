import { SELECTORS } from './domSelectors';
import { loadSettings, AppSettings, STORAGE_KEYS } from './storage';
import { safeClick, observeAndInteract } from './utils/dom';

console.log('POE / POE2 Quick Launch Content Script Loaded');
globalThis.addEventListener('hashchange', async () => {
    console.log('[Content] Hash changed:', globalThis.location.hash);
    if (globalThis.location.hash.includes('#autoStart')) {
        const settings = await loadSettings();

        // Only POE2 Main Page re-triggering logic for now
        const currentUrl = new URL(globalThis.location.href);
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
        if (globalThis.location.hash.includes('#autoStart')) {
            console.log('Auto Start triggered on POE.');
            startMainPagePolling(settings, SELECTORS.POE.BTN_GAME_START);
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
        const isAutoStart = globalThis.location.hash.includes('#autoStart');

        if (shouldDismissToday || isAutoStart) {
            manageIntroModal(shouldDismissToday);
        }

        if (isAutoStart) {
            console.log('Auto Start triggered on Homepage.');

            // Register this tab as the Main Game Tab for later closing
            chrome.runtime.sendMessage({ action: 'registerMainTab' });

            chrome.runtime.sendMessage({ action: 'setAutoSequence', value: true });
            startMainPagePolling(settings, SELECTORS.POE2.BTN_GAME_START);
        }
    }
};

const LauncherCheckHandler: PageHandler = {
    name: 'LauncherCheckHandler',
    description: 'Launcher Game Start Check & Init Page (When Not Logged In)',
    match: (url) => {
        if (url.hostname !== 'pubsvc.game.daum.net') return false;
        // Check for specific game start pages (poe.html or poe2.html)
        return (
            url.pathname.includes('/gamestart/poe.html') ||
            url.pathname.includes('/gamestart/poe2.html')
        );
    },
    allowedReferrers: [
        'poe.game.daum.net',
        'pathofexile2.game.daum.net',
        'logins.daum.net',
        'pubsvc.game.daum.net'
    ],
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
            return (
                nextUrl.hostname === 'pubsvc.game.daum.net' &&
                (nextUrl.pathname.includes('/gamestart/poe.html') ||
                    nextUrl.pathname.includes('/gamestart/poe2.html'))
            );
        } catch {
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

// ... (Existing Imports)

// ... (Existing Handlers 1-7)

const LauncherCompletionHandler: PageHandler = {
    name: 'LauncherCompletionHandler',
    description: 'Launcher Execution Confirmation Page',
    match: (url) => {
        if (url.hostname !== 'pubsvc.game.daum.net') return false;
        if (!url.pathname.includes('/securitycenter') || !url.pathname.includes('/completed.html'))
            return false;

        const gameCode = url.searchParams.get('gameCode');
        return gameCode === 'poe' || gameCode === 'poe2';
    },
    allowedReferrers: ['security-center.game.daum.net'],
    execute: (settings) => {
        console.log(`[Handler Execute] ${LauncherCompletionHandler.description}`);

        // 1. Process Completion (Signal Close Tab, Update Tutorial Mode) - execute FIRST
        handleCompletionPage(settings);

        // 2. Click 'Game Start' if present (Might close window, so do this last)
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

    const currentUrl = new URL(globalThis.location.href);
    console.log('Dispatching logic for:', currentUrl.href);
    console.log('Referrer:', document.referrer);

    for (const handler of HANDLERS) {
        if (!handler.match(currentUrl)) continue;

        console.log(`[Handler Match] ${handler.name} matched.`);

        // Referrer Validation
        if (handler.allowedReferrers) {
            const currentReferrer = document.referrer;
            const isValid = handler.allowedReferrers.some((ref) => currentReferrer.includes(ref));

            if (!isValid) {
                console.warn(
                    `[Handler Skip] ${handler.name} - Invalid Referrer: "${currentReferrer}"`
                );
                return;
            }
        }

        handler.execute(settings);
        return;
    }

    console.log('No matching handler found for this page.');
}

// -----------------------------------------------------------------------------
// Helper Logic
// -----------------------------------------------------------------------------

// Unified Main Page Polling Logic
function startMainPagePolling(_settings: AppSettings, buttonSelector: string) {
    let attempts = 0;
    const maxAttempts = 50; // 10 seconds (50 * 200ms)

    const interval = setInterval(() => {
        attempts++;
        const startBtn = document.querySelector(buttonSelector) as HTMLElement;

        if (startBtn) {
            // Unconditional Cleanup - BEFORE click
            console.log('[Content] Removing #autoStart from URL (Pre-click)...');
            history.replaceState(
                null,
                '',
                globalThis.location.pathname + globalThis.location.search
            );

            console.log(
                `[Attempt ${attempts}] Found Start Button (${buttonSelector}), clicking...`
            );
            safeClick(startBtn);

            console.log('Start Button clicked. Stopping polling immediately.');
            clearInterval(interval);

            // Register this tab as Main Tab
            chrome.runtime.sendMessage({ action: 'registerMainTab' });

            console.log('Main Page Game Start clicked.');
            console.log('Game Start Clicked. Waiting for Launcher Completion to close tab.');

            return;
        }

        if (attempts >= maxAttempts) {
            clearInterval(interval);
            console.log(`Stopped polling for Start Button (${buttonSelector}). Not found.`);
        }
    }, 200);
}

function handleCompletionPage(settings: AppSettings) {
    console.log('*** Game Launch Completed! ***');

    // Tutorial Completion Logic
    if (settings.isTutorialMode) {
        console.log('Tutorial Mode: OFF. Future runs will auto-close.');
        chrome.storage.local.set({ [STORAGE_KEYS.IS_TUTORIAL_MODE]: false });
        // NOTE: In Tutorial Mode, we do NOT close the tab even on completion,
        // so the user can clearly see "Run Completed" and check their browser settings if needed.
        // OR should we close it? User requirement was "Don't close to allow popup permission".
        // Once completed, popup permission IS granted (presumably).
        // But for safety/feedback, let's keep it open this one time.
    } else if (settings.closeTab) {
        // [Safety Check]
        // Structurally, 'closeTab' should be false if 'isTutorialMode' is true (enforced by UI in popup.ts).
        // However, we double-check here to prevent any edge cases where storage might be inconsistent.
        console.log('Closing Main Tab (as per settings)...');
        chrome.runtime.sendMessage({ action: 'closeMainTab' });
    }
}

function performLauncherPageLogic(settings: AppSettings) {
    observeAndInteract((obs) => {
        const query = SELECTORS.LAUNCHER.GAME_START_BUTTONS.join(', ');
        const buttons = Array.from(document.querySelectorAll(query + ', .popup__link--confirm'));

        // 1. Check for Login Required Popup
        if (
            SELECTORS.LAUNCHER.LOGIN_REQUIRED_TEXTS.some((text) =>
                document.body.innerText.includes(text)
            )
        ) {
            // ... (Existing Login Popup Logic)
            const confirmBtn = buttons.find(
                (el) =>
                    el.classList.contains(SELECTORS.LAUNCHER.BTN_CONFIRM.substring(1)) ||
                    (el as HTMLElement).innerText?.trim() === '확인'
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
        const gameStartBtn = buttons.find((el) => {
            if (el.id === 'gameStart' || el.classList.contains('btn-start-game')) return true;
            const text = (el as HTMLElement).innerText?.trim();
            return text === '게임시작' || text === 'GAME START';
        });

        if (gameStartBtn) {
            console.log('Launcher Game Start found. Clicking...');
            safeClick(gameStartBtn as HTMLElement);

            // Note: We NO LONGER close the tab here. We wait for Completion.
            console.log('Launcher Button Clicked. Logic continues...');

            // Fallback Logic (Only if it was an auto-start attempt)
            if (globalThis.location.hash.includes('#autoStart') || settings.isTutorialMode) {
                setTimeout(() => {
                    console.log('Fallback Timer Triggered: User still on page?');
                    showTutorialToast(
                        '⚠️ 게임이 실행되지 않았나요? 상단 주소창의 <b>"팝업 차단"</b>을 확인해주세요!'
                    );
                }, 15000);
            }

            if (obs) obs.disconnect();
            return true;
        }
        return false;
    });
}
// ... (startPolling) -> Need to update startPolling separately as it's further down?
// Wait, replace_file_content replaces a chunk. I need to be careful about matching.
// I will perform targeted replacements instead of one giant chunk to be safer.

// ... (Existing Helpers continued)

function performSecurityPageLogic() {
    observeAndInteract((obs) => {
        const buttons = Array.from(
            document.querySelectorAll(SELECTORS.SECURITY.CONFIRM_BUTTONS.join(', '))
        );

        // Priority 0: Designated PC "Confirm" Button
        const designPcBtn = buttons.find((el) =>
            el.classList.contains(SELECTORS.SECURITY.BTN_DESIGNATED_CONFIRM.substring(1))
        );
        if (designPcBtn) {
            console.log('Found Designated PC Confirm button. Clicking...');
            safeClick(designPcBtn as HTMLElement);
            if (obs) obs.disconnect();
            return true;
        }

        // Priority 1: Generic Confirm (Fallback)
        const confirmBtn = buttons.find((el) => {
            return (
                el.classList.contains(SELECTORS.SECURITY.BTN_POPUP_CONFIRM.substring(1)) ||
                (el as HTMLElement).innerText?.trim() === '확인'
            );
        });

        if (confirmBtn) {
            console.log('Found Generic Confirm button. Clicking...');
            safeClick(confirmBtn as HTMLElement);
            if (obs) obs.disconnect();
            return true;
        }
        return false;
    });
}

// ... (Existing Helpers continued)

function showTutorialToast(message: string) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #333;
        color: #fff;
        padding: 12px 24px;
        border-radius: 8px;
        z-index: 99999;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        gap: 8px;
        animation: slideDown 0.3s ease-out;
    `;
    toast.innerHTML = message;
    document.body.appendChild(toast);

    // Auto remove after 10s
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 10000);
}

// ... (Existing Helpers continued)

function manageIntroModal(preferTodayClose: boolean) {
    if (document.cookie.includes('POE2_INTRO_MODAL=1')) {
        console.log('Intro Modal cookie already present. Skipping modal logic.');
        return;
    }

    console.log(`Managing Intro Modal. Prefer 'Today Close': ${preferTodayClose}`);

    if (preferTodayClose) {
        try {
            if (!document.cookie.includes('POE2_INTRO_MODAL=1')) {
                document.cookie = 'POE2_INTRO_MODAL=1; path=/; max-age=86400';
                console.log('Set POE2_INTRO_MODAL=1 cookie.');
            }
        } catch (e) {
            console.warn('Cookie write failed:', e);
        }
    }

    const dismissAttempt = () => {
        const introContent = document.getElementById(SELECTORS.POE2.INTRO_MODAL_ID);
        if (!introContent) return false;

        const container = introContent.closest(SELECTORS.POE2.MODAL_CONTAINER);
        if (!container) return false;

        if ((container as HTMLElement).offsetParent === null) return false;

        if (preferTodayClose) {
            const todayBtn = container.querySelector(SELECTORS.POE2.BTN_TODAY_CLOSE);
            if (todayBtn) {
                console.log('Found "Today Close" button. Clicking...');
                safeClick(todayBtn as HTMLElement);
                return true;
            }
        }

        const closeBtn = container.querySelector(SELECTORS.POE2.BTN_CLOSE_X);
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

// Entry Point
const settings = await loadSettings();
dispatchPageLogic(settings);

export {};
