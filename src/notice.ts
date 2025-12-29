
import { Notice } from './storage';

const NOTICE_URL = 'https://nerdhead-lab.github.io/POE2-quick-launch-for-kakao/notice.json';

export async function fetchNotices(): Promise<Notice[]> {
    try {
        const response = await fetch(NOTICE_URL);
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
