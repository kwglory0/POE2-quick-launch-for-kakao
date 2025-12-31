import { EXT_URLS } from './constants';
import { PatchNote } from './storage';

export async function fetchPatchNotes(game: 'poe' | 'poe2', limit: number): Promise<PatchNote[]> {
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 1000;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const url =
            game === 'poe' ? EXT_URLS.POE.PATCH_NOTES_FORUM : EXT_URLS.POE2.PATCH_NOTES_FORUM;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const text = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');

            const rows = Array.from(doc.querySelectorAll('table.forumTable tr:not(.heading)'));
            const notes: PatchNote[] = [];

            for (const row of rows) {
                if (notes.length >= limit) break;

                // Skip sticky posts
                if (row.querySelector('.flag.sticky')) continue;

                const titleEl = row.querySelector('.title a') as HTMLAnchorElement;
                const dateEl = row.querySelector('.postBy .post_date') as HTMLSpanElement;

                if (titleEl && dateEl) {
                    const title = titleEl.innerText.trim();
                    const link = `https://poe.game.daum.net${titleEl.getAttribute('href')}`;
                    const dateStr = dateEl.innerText.replace(/^, /, '').trim();

                    notes.push({
                        title,
                        link,
                        date: dateStr,
                        isNew: false // Default false, computed later against cache
                    });
                }
            }

            return notes;
        } catch (error) {
            if (attempt >= MAX_RETRIES) {
                console.error(
                    `[PatchNotes] All ${MAX_RETRIES} attempts failed for ${game} (${url}).`,
                    error
                );
                return [];
            }

            console.info(
                `[PatchNotes] Fetch attempt ${attempt} failed for ${game} (${url}). Retrying...`,
                error
            );
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        }
    }
    return [];
}

export function getPatchNoteUrl(game: 'poe' | 'poe2'): string {
    return game === 'poe' ? EXT_URLS.POE.PATCH_NOTES_FORUM : EXT_URLS.POE2.PATCH_NOTES_FORUM;
}
