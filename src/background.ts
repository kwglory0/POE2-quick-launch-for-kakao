// Message types
console.log('!!! Background Service Worker Initialized !!!');

// Allow Content Scripts to access chrome.storage.session
// Allow Content Scripts to access chrome.storage.session
if (chrome.storage.session && chrome.storage.session.setAccessLevel) {
    try {
        chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
    } catch (error) {
        console.warn('Failed to set access level for session storage:', error);
    }
}

interface MessageRequest {
    action: string;
    shouldCloseMainPage?: boolean;
    value?: boolean;
}

chrome.runtime.onMessage.addListener((request: MessageRequest, sender, sendResponse) => {
    console.log('Background received message:', request, 'from sender:', sender);

    if (request.action === 'closeTab') {
        if (sender.tab && sender.tab.id) {
            chrome.tabs.remove(sender.tab.id);
        }
    }

    if (request.action === 'registerMainTab') {
        if (sender.tab && sender.tab.id) {
            chrome.storage.session.set({ 'mainGameTabId': sender.tab.id });
            console.log('[Background] Registered Main Game Tab ID:', sender.tab.id);
        }
    } else if (request.action === 'closeMainTab') {
        chrome.storage.session.get(['mainGameTabId'], (result) => {
            const tabId = result['mainGameTabId'] as number | undefined;
            if (tabId) {
                console.log('[Background] Received closeMainTab signal. Closing tab in 1s:', tabId);

                setTimeout(() => {
                    chrome.tabs.remove(tabId, () => {
                        const err = chrome.runtime.lastError;
                        if (err) console.warn('[Background] Failed to close tab (maybe already closed):', err);
                        else console.log('[Background] Main Game Tab closed successfully.');

                        // Cleanup session storage
                        chrome.storage.session.remove('mainGameTabId');
                    });
                }, 1000);
            } else {
                console.warn('[Background] received closeMainTab but no ID found in session.');
            }
        });
    } else if (request.action === 'launcherGameStartClicked') {
        // Deprecated action kept potentially for logging or if needed, but logic removed
        console.log(`[Background] Deprecated 'launcherGameStartClicked' received. No action taken.`);
    } else if (request.action === 'checkAutoSequence') {
        chrome.storage.session.get(['isAutoSequence'], (result) => {
            sendResponse({ isAutoSequence: result['isAutoSequence'] });
        });
        return true; // Will respond asynchronously
    } else if (request.action === 'setAutoSequence') {
        const val = request.value;
        console.log('[Background] Setting Auto Sequence flag to:', val);
        chrome.storage.session.set({ 'isAutoSequence': val });
        sendResponse('ok');
    }
});
