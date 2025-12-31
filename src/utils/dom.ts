/**
 * Safely clicks an element, handling both native click() and javascript: hrefs.
 */
export function safeClick(element: HTMLElement) {
    if (!element) return;

    if (
        element instanceof HTMLAnchorElement &&
        element.href.toLowerCase().startsWith('javascript:')
    ) {
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

/**
 * Validates if the text content of an element contains specific text.
 */
export function hasText(element: HTMLElement, text: string): boolean {
    return (element.innerText || '').includes(text);
}

/**
 * Generalized Observer Pattern for finding and acting on elements.
 * @param checkFn A function that returns true if the target was found and acted upon.
 * @param timeoutMs Max duration to observe (default 10000ms).
 */
export function observeAndInteract(
    checkFn: (obs?: MutationObserver) => boolean,
    timeoutMs: number = 10000
) {
    // 1. Try immediately
    if (checkFn()) return;

    console.log('[DOM] Target not found immediately. Starting observer...');

    // 2. Start Observer
    const observer = new MutationObserver((_mutations, obs) => {
        if (checkFn(obs)) {
            // checkFn is responsible for disconnecting if successful,
            // but we can ensure it here if checkFn returns true?
            // Usually checkFn calls obs.disconnect() to stop immediately.
            // But to be safe, we can disconnect here too if returned true.
            // checking inside checkFn gives more control (e.g. partial success).
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // 3. Safety Timeout
    if (timeoutMs > 0) {
        setTimeout(() => {
            observer.disconnect();
            console.log('[DOM] Observer timed out.');
        }, timeoutMs);
    }
}
