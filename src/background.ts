// Message types
interface MessageRequest {
    action: string;
}

chrome.runtime.onMessage.addListener((request: MessageRequest, sender, sendResponse) => {
    if (request.action === 'closeTab') {
        if (sender.tab && sender.tab.id) {
            chrome.tabs.remove(sender.tab.id);
        }
    } else if (request.action === 'checkAutoSequence') {
        chrome.storage.session.get(['isAutoSequence'], (result) => {
            sendResponse({ isAutoSequence: result['isAutoSequence'] });
        });
        return true; // Will respond asynchronously
    }
});
