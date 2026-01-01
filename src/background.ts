// Message types
console.log('!!! Background Service Worker Initialized !!!');

// -----------------------------------------------------------------------------
// Install / Update Handler
// -----------------------------------------------------------------------------
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.storage.local.get(['isTutorialMode'], (result) => {
            if (result.isTutorialMode === undefined) {
                console.log(
                    '[Background] Fresh install (No Settings). Setting Tutorial Mode = ON.'
                );
                chrome.storage.local.set({ isTutorialMode: true });
            } else {
                console.log(
                    '[Background] Install detected but settings exist. Preserving existing Tutorial Mode.'
                );
            }
        });
    } else if (details.reason === 'update') {
        chrome.storage.local.get(['isTutorialMode'], (result) => {
            if (result.isTutorialMode === undefined) {
                console.log(
                    '[Background] Update detected. Initializing Tutorial Mode to OFF for existing user.'
                );
                chrome.storage.local.set({ isTutorialMode: false });
            }
        });
    }
});

interface MessageRequest {
    action: string;
    shouldCloseMainPage?: boolean;
    value?: boolean;
}

chrome.runtime.onMessage.addListener((request: MessageRequest, sender, sendResponse) => {
    console.log('Background received message:', request, 'from sender:', sender);

    if (request.action === 'closeTab') {
        if (sender.tab?.id) {
            chrome.tabs.remove(sender.tab.id);
        }
    }

    if (request.action === 'registerMainTab') {
        if (sender.tab?.id) {
            chrome.storage.session.set({ mainGameTabId: sender.tab.id });
            console.log('[Background] Registered Main Game Tab ID:', sender.tab.id);
        }
    } else if (request.action === 'closeMainTab') {
        chrome.storage.session.get(['mainGameTabId'], (result) => {
            const tabId = result['mainGameTabId'] as number | undefined;
            if (!tabId) {
                console.warn('[Background] received closeMainTab but no ID found in session.');
                return;
            }

            console.log('[Background] Received closeMainTab signal. Closing tab in 1s:', tabId);

            setTimeout(() => {
                chrome.tabs.remove(tabId, () => {
                    const err = chrome.runtime.lastError;
                    if (err)
                        console.warn(
                            '[Background] Failed to close tab (maybe already closed):',
                            err
                        );
                    else console.log('[Background] Main Game Tab closed successfully.');

                    // Cleanup session storage
                    chrome.storage.session.remove('mainGameTabId');
                });
            }, 1000);
        });
    } else if (request.action === 'checkAutoSequence') {
        chrome.storage.session.get(['isAutoSequence'], (result) => {
            sendResponse({ isAutoSequence: result['isAutoSequence'] });
        });
        return true; // Will respond asynchronously
    } else if (request.action === 'setAutoSequence') {
        const val = request.value;
        console.log('[Background] Setting Auto Sequence flag to:', val);
        chrome.storage.session.set({ isAutoSequence: val });
    }
});
