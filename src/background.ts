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

    if (request.action === 'launcherGameStartClicked') {
        const shouldCloseMainPage = request.shouldCloseMainPage;
        console.log(`Background received "Game Start Clicked". Close Main Page? ${shouldCloseMainPage}`);
        sendResponse('ok');

        // 1. Wait 5 seconds (Safety for UAC / Custom Protocol)
        // This timer runs in the Background, so it persists even if the Launcher Tab closes instantly.
        setTimeout(() => {
            console.log('5s Safety Timer finished. Proceeding to cleanup...');

            // 2. Close the Launcher Popup (Conditional)
            // If the signal came from the Main Page (fallback trigger), DO NOT close it here.
            // Only close if it's an actual Launcher/Popup tab.
            if (sender.tab && sender.tab.id) {
                const isMainPage = sender.tab.url && sender.tab.url.includes('/main');
                if (!isMainPage) {
                    console.log('Closing Launcher tab:', sender.tab.id);
                    chrome.tabs.remove(sender.tab.id).catch(() => console.log('Launcher tab likely already closed.'));
                } else {
                    console.log('Signal came from Main Page. Keeping tab open for now (logic specific below).');
                }
            }

            // 3. Handle Main Page (Close OR Cleanup)
            setTimeout(() => {
                chrome.tabs.query({ url: "*://*.game.daum.net/*" }, (tabs) => {
                    const mainPageTabs = tabs.filter(t => t.url && t.url.includes('/main'));
                    const tabIds = mainPageTabs.map(t => t.id).filter((id): id is number => id !== undefined);

                    if (tabIds.length === 0) {
                        console.log('[Background] No Main Page tabs found.');
                        return;
                    }

                    if (shouldCloseMainPage) {
                        console.log('[Background] Closing Main Page tab(s):', tabIds);
                        chrome.tabs.remove(tabIds);
                    } else {
                        console.log('[Background] Auto Close disabled. Sending "cleanupUrl" signal to Main Page:', tabIds);
                        tabIds.forEach(id => {
                            chrome.tabs.sendMessage(id, { action: 'cleanupUrl' }, (response) => {
                                if (chrome.runtime.lastError) {
                                    console.error(`[Background] Failed to send cleanup to tab ${id}:`, chrome.runtime.lastError);
                                } else {
                                    console.log(`[Background] Cleanup signal delivered to tab ${id}. Response:`, response);
                                }
                            });
                        });
                    }
                });
            }, 1000);
        }, 5000);
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
