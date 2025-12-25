/**
 * DOM Selectors for POE2 Quick Launch
 * Organized by Page Type and Functionality.
 */

export const SELECTORS = {
    // -------------------------------------------------------------------------
    // 1. Main Page (/main)
    // -------------------------------------------------------------------------
    MAIN: {
        // The container holding the intro modal content
        // Used to block Game Start until dismissed
        MODAL_CONTAINER: '.modal__container',

        // Specific ID to identify the correct modal (User provided)
        INTRO_MODAL_ID: 'kgIntroModalContents',

        // "Don't show for today" button inside the modal
        BTN_TODAY_CLOSE: '.modal__button-block',

        // General "Close" (X) button inside the modal
        BTN_CLOSE_X: '.modal__button-x',

        // The "Game Start" button on the main page
        BTN_GAME_START: '.main-start__link'
    },

    // -------------------------------------------------------------------------
    // 2. Launcher / PubSvc Page (gamestart, pubsvc)
    // -------------------------------------------------------------------------
    LAUNCHER: {
        // Potential "Game Start" buttons.
        // We check these in order or by checking availability.
        GAME_START_BUTTONS: [
            '#gameStart',           // Standard ID
            '.btn-start-game',      // Standard Class
            'a',                    // Fallback to searching all links...
            'button',               // ...and buttons
            'span.btn_g',           // Generic Daum buttons
            '.popup__link--confirm' // Sometimes confirm buttons launch game?
        ],

        // Text content to identify "Login Required" popup
        LOGIN_REQUIRED_TEXTS: [
            '로그인이 필요한 서비스',
            '로그인 하시겠습니까'
        ],

        // "Confirm" button in popups (like Login Required)
        BTN_CONFIRM: '.popup__link--confirm'
    },

    // -------------------------------------------------------------------------
    // 3. Security Center / Designated PC Page (security-center)
    // -------------------------------------------------------------------------
    SECURITY: {
        // Candidates for the "Confirm" or "Done" button
        CONFIRM_BUTTONS: [
            'a',
            'button',
            'span.btn_g',
            '.popup__link--confirm',
            '.btn-confirm'
        ],

        // Specific class for Designated PC confirm button
        BTN_DESIGNATED_CONFIRM: '.btn-confirm',

        // Generic popup confirm button
        BTN_POPUP_CONFIRM: '.popup__link--confirm'
    }
};
