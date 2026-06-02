/**
 * Resume evaluation SSE helpers (used by resume-evaluator.js).
 */
(function (global) {
    function handleEvalStreamEvent(eventData, ctx) {
        if (!eventData || !eventData.status) return false;

        if (eventData.status === 'eval_field_preview') {
            if (eventData.field === 'profile_summary' && eventData.snippet && ctx.profileSummaryEl) {
                if (!ctx.profileSummaryEl.textContent.trim()) {
                    ctx.profileSummaryEl.textContent = eventData.snippet;
                }
                if (ctx.markEvalSectionReady) ctx.markEvalSectionReady('profile-summary');
            }
            return true;
        }
        return false;
    }

    global.PlutoEvalStream = { handleEvalStreamEvent };
})(typeof window !== 'undefined' ? window : globalThis);
