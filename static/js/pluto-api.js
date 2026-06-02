/**
 * Shared fetch helper: CSRF header + JSON defaults for PLUTO API calls.
 */
(function (global) {
    function getCsrfToken() {
        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.getAttribute('content') : '';
    }

    function plutoFetch(url, options) {
        options = options || {};
        const method = (options.method || 'GET').toUpperCase();
        const headers = Object.assign({}, options.headers || {});

        if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
            const token = getCsrfToken();
            if (token) {
                headers['X-CSRFToken'] = token;
            }
        }

        let body = options.body;
        if (
            body &&
            typeof body === 'object' &&
            !(body instanceof FormData) &&
            !(body instanceof Blob)
        ) {
            if (!headers['Content-Type']) {
                headers['Content-Type'] = 'application/json';
            }
            body = JSON.stringify(body);
        }

        return fetch(url, Object.assign({}, options, { method, headers, body }));
    }

    global.getCsrfToken = getCsrfToken;
    global.plutoFetch = plutoFetch;
})(typeof window !== 'undefined' ? window : globalThis);
