/**
 * Handbook SSE client (shared by resume-evaluator.js).
 */
(function (global) {
    async function streamHandbookGeneration(payload, { signal, onDelta, onStatus, onSection }) {
        const apiFetch = global.apiFetch || global.plutoFetch;
        if (!apiFetch) {
            throw new Error('apiFetch/plutoFetch is not available');
        }

        const response = await apiFetch('/api/generate-recruiter-handbook-stream', {
            method: 'POST',
            signal,
            headers: { Accept: 'text/event-stream' },
            body: payload,
        });
        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            throw new Error(errBody.message || `HTTP ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullMarkdown = '';
        let existingPayload = null;
        let handbookId = null;
        let sawExisting = false;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                let event;
                try {
                    event = JSON.parse(line.slice(6));
                } catch (parseErr) {
                    console.warn('handbook SSE parse skip', parseErr);
                    continue;
                }
                if (event.type === 'meta' && event.message && onStatus) {
                    onStatus(event.message);
                } else if (event.type === 'section' && typeof event.index === 'number') {
                    if (onSection) onSection(event.index);
                    if (global.advanceHandbookLoaderFromMarkdown) {
                        global.advanceHandbookLoaderFromMarkdown('### ' + String(event.index + 1));
                    }
                } else if (event.type === 'existing') {
                    sawExisting = true;
                    existingPayload = event;
                    fullMarkdown = event.markdown_content || fullMarkdown;
                    if (onDelta) onDelta(fullMarkdown);
                } else if (event.type === 'delta') {
                    fullMarkdown += event.content || '';
                    if (onDelta) onDelta(fullMarkdown);
                } else if (event.type === 'done') {
                    handbookId = event.handbook_id;
                    if (event.existing) sawExisting = true;
                    return {
                        success: true,
                        markdown_content: fullMarkdown,
                        handbook_id: handbookId,
                        existing: sawExisting,
                        existingPayload,
                        job_title: payload.job_title,
                        oorwin_job_id: payload.oorwin_job_id,
                    };
                } else if (event.type === 'error') {
                    throw new Error(event.message || 'Handbook generation failed');
                }
            }
        }

        if (!fullMarkdown) {
            throw new Error('Handbook stream ended without content');
        }
        return {
            success: true,
            markdown_content: fullMarkdown,
            handbook_id: handbookId,
            existing: sawExisting,
            existingPayload,
            job_title: payload.job_title,
            oorwin_job_id: payload.oorwin_job_id,
        };
    }

    global.PlutoHandbookStream = { streamHandbookGeneration };
})(typeof window !== 'undefined' ? window : globalThis);
