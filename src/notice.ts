import { EXT_URLS } from './constants';
import { Notice } from './storage';

export async function fetchNotices(): Promise<Notice[]> {
    try {
        const response = await fetch(EXT_URLS.NOTICE_JSON);
        if (!response.ok) {
            throw new Error(`Failed to fetch notices: ${response.statusText}`);
        }
        const notices: Notice[] = await response.json();
        return notices;
    } catch (error) {
        console.error('Failed to load notices:', error);
        return [];
    }
}
