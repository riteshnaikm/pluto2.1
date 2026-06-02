/**
 * PLUTO Recruiter Handbook — evolved workspace layer (presentation + light DOM).
 * Depends on resume-evaluator.js (buildHandbookIntelligenceWorkspace on window).
 */
(function () {
    'use strict';

    function scrollToHandbookResult() {
        var el = document.getElementById('handbook-result-section');
        if (!el) return;
        var pad = 12;
        var y = el.getBoundingClientRect().top + window.scrollY - pad;
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    }

    function tileRank(node) {
        var sum = (node.querySelector(':scope > summary') && node.querySelector(':scope > summary').textContent) || '';
        sum = sum.toLowerCase();
        if (node.classList.contains('ce-job-summary-module')) return 0;
        if (node.classList.contains('ce-redflags-module')) return 2;
        if (/overqualification|overkill/.test(sum)) return 3;
        if (/primary\s+sourcing|must-have/.test(sum)) return 4;
        if (node.classList.contains('ce-screening-module')) return 5;
        if (node.classList.contains('ce-talent-module')) return 8;
        if (node.classList.contains('ce-boolean-module')) return 9;
        return 15;
    }

    function plutoReorderHandbookTiles(tilesWrap) {
        var tiles = Array.prototype.filter.call(tilesWrap.children, function (n) {
            return n.matches && n.matches('details.ce-tile');
        });
        if (tiles.length < 2) return;
        var indexed = tiles.map(function (node, i) {
            return { node: node, i: i };
        });
        indexed.sort(function (a, b) {
            var ra = tileRank(a.node);
            var rb = tileRank(b.node);
            if (ra !== rb) return ra - rb;
            return a.i - b.i;
        });
        indexed.forEach(function (x) {
            tilesWrap.appendChild(x.node);
        });
    }

    function plutoApplyTileVariantClasses(tilesWrap) {
        tilesWrap.querySelectorAll('details.ce-tile').forEach(function (d) {
            var sum = (d.querySelector(':scope > summary') && d.querySelector(':scope > summary').textContent) || '';
            sum = sum.toLowerCase();
            if (d.classList.contains('ce-redflags-module') || /red\s+flags/.test(sum)) d.classList.add('ce-tile--risk');
            if (/overqualification|overkill/.test(sum)) d.classList.add('ce-tile--risk');
            if (d.classList.contains('ce-boolean-module')) d.classList.add('ce-tile--boolean');
            if (d.classList.contains('ce-talent-module')) d.classList.add('ce-tile--pools');
            if (d.classList.contains('ce-screening-module')) d.classList.add('ce-tile--screening');
        });
    }

    function plutoWrapBooleanConsoleRows() {
        document.querySelectorAll('#handbook-content .ce-boolean-query').forEach(function (el) {
            if (el.closest('.hb-boolean-console')) return;
            var wrap = document.createElement('div');
            wrap.className = 'hb-boolean-console';
            el.parentNode.insertBefore(wrap, el);
            wrap.appendChild(el);
        });
    }

    function plutoEnhanceListItemBooleans() {
        var hc = document.getElementById('handbook-content');
        if (hc && hc.dataset.workspaceBuilt === '1') return;
        document.querySelectorAll('#handbook-content li').forEach(function (li) {
            if (li.querySelector('button[data-hb-boolean-copy]')) return;
            var text = (li.textContent || '').trim();
            if (text.length < 24 || text.length > 260) return;
            if (!/(\(|\)|\bAND\b|\bOR\b|site:|github\.com\/search)/i.test(text)) return;
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-sm btn-outline-primary mt-1';
            btn.setAttribute('data-hb-boolean-copy', '1');
            btn.innerHTML = '<i class="bi bi-clipboard"></i> Copy';
            btn.addEventListener('click', function () {
                if (window.copyToClipboard) window.copyToClipboard(text, btn);
                else navigator.clipboard.writeText(text);
            });
            li.appendChild(btn);
        });
    }

    function wireWorkflowRail(rail) {
        if (rail.dataset.plutoBound === '1') return;
        rail.dataset.plutoBound = '1';
        rail.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-hb-action]');
            if (!btn) return;
            var action = btn.getAttribute('data-hb-action');
            var wrap = document.querySelector('#handbook-content .ce-tiles-wrap');
            var tiles = wrap ? wrap.querySelectorAll('details.ce-tile') : [];
            if (action === 'expand-all') {
                Array.prototype.forEach.call(tiles, function (t) {
                    t.open = true;
                });
            } else if (action === 'collapse-all') {
                Array.prototype.forEach.call(tiles, function (t) {
                    t.open = false;
                });
            } else if (action === 'jump-risk') {
                var risk =
                    wrap &&
                    Array.prototype.find.call(wrap.querySelectorAll('details.ce-tile'), function (t) {
                        return (
                            t.classList.contains('ce-redflags-module') ||
                            /red\s+flags|overqualification|overkill/i.test(
                                (t.querySelector(':scope > summary') && t.querySelector(':scope > summary').textContent) || ''
                            )
                        );
                    });
                if (risk) {
                    risk.open = true;
                    requestAnimationFrame(function () {
                        var top = risk.getBoundingClientRect().top + window.scrollY - 72;
                        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
                    });
                }
            }
        });
    }

    function ensureHandbookWorkflowRail() {
        var main = document.querySelector('#handbook-result-section .ce-main-workspace');
        var nav = document.getElementById('handbookMiniNav');
        if (!main || !nav) return;
        var rail = main.querySelector('.hb-workflow-rail');
        if (!rail) {
            rail = document.createElement('div');
            rail.className = 'hb-workflow-rail';
            rail.setAttribute('role', 'toolbar');
            rail.setAttribute('aria-label', 'Handbook section controls');
            rail.innerHTML =
                '<button type="button" class="btn btn-sm btn-outline-secondary" data-hb-action="expand-all">Expand all</button>' +
                '<button type="button" class="btn btn-sm btn-outline-secondary" data-hb-action="collapse-all">Collapse all</button>' +
                '<button type="button" class="btn btn-sm btn-primary" data-hb-action="jump-risk"><i class="bi bi-shield-exclamation me-1"></i>Jump to risk</button>';
            var sheet = main.querySelector('.ce-handbook-sheet');
            if (sheet) {
                var before = sheet.querySelector('.ce-handbook-primary-card, section.ce-card') || sheet.firstChild;
                sheet.insertBefore(rail, before);
            } else if (nav.parentNode) {
                nav.parentNode.insertBefore(rail, nav);
            } else {
                main.insertBefore(rail, main.firstChild);
            }
        }
        wireWorkflowRail(rail);
    }

    function plutoEnsureTileIds(tilesWrap) {
        var used = new Set(
            Array.prototype.map.call(document.querySelectorAll('[id]'), function (el) {
                return el.id;
            })
        );
        tilesWrap.querySelectorAll('details.ce-tile:not([id])').forEach(function (d) {
            var span = d.querySelector(':scope > summary .ce-tile-title span');
            var label = (span && span.textContent) || '';
            var slug = label
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '')
                .slice(0, 72);
            if (!slug) slug = 'handbook-section';
            var id = slug;
            var c = 1;
            while (used.has(id)) {
                id = slug + '-' + ++c;
            }
            used.add(id);
            d.id = id;
        });
    }

    function plutoEvolveAfterWorkspace() {
        var wrap = document.querySelector('#handbook-content .ce-tiles-wrap');
        if (!wrap) return;
        plutoReorderHandbookTiles(wrap);
        plutoApplyTileVariantClasses(wrap);
        plutoEnsureTileIds(wrap);
        plutoWrapBooleanConsoleRows();
        ensureHandbookWorkflowRail();
        try {
            if (typeof window.renderHandbookMiniNav === 'function') window.renderHandbookMiniNav();
        } catch (err) {
            console.warn('renderHandbookMiniNav', err);
        }
    }

    function patchWorkspaceBuild() {
        var orig = window.buildHandbookIntelligenceWorkspace;
        if (typeof orig !== 'function' || orig._plutoWrapped) return;
        function wrapped() {
            var ret = orig.apply(this, arguments);
            plutoEvolveAfterWorkspace();
            return ret;
        }
        wrapped._plutoWrapped = true;
        window.buildHandbookIntelligenceWorkspace = wrapped;
    }

    function patchBooleanSamples() {
        var orig = window.addCopyButtonsToBooleanSamples;
        if (typeof orig !== 'function' || orig._plutoWrapped) return;
        function wrapped() {
            var ret = orig.apply(this, arguments);
            plutoEnhanceListItemBooleans();
            return ret;
        }
        wrapped._plutoWrapped = true;
        window.addCopyButtonsToBooleanSamples = wrapped;
    }

    window.scrollToHandbookResult = scrollToHandbookResult;
    window.ensureHandbookWorkflowRail = ensureHandbookWorkflowRail;

    window.renderHandbookMiniNav = function renderHandbookMiniNav() {
        var nav = document.getElementById('handbookMiniNav');
        var container = document.getElementById('handbook-content');
        if (!nav || !container) return;

        var wanted = [
            /Primary\s+Sourcing\s+Parameters/i,
            /Screening\s+Framework/i,
            /Target\s+Talent\s+Pools/i,
            /Red\s+Flags/i,
            /Recruiter\s+Checklist/i,
            /Recruiter\s+Sales\s+Pitch/i,
            /Overqualification/i
        ];
        var tiles = Array.prototype.slice.call(container.querySelectorAll('details.ce-tile'));
        var items = [];
        wanted.forEach(function (re) {
            var tile = tiles.find(function (d) {
                var sum = (d.querySelector(':scope > summary') && d.querySelector(':scope > summary').textContent) || '';
                return re.test(sum.trim());
            });
            if (tile && tile.id) {
                var span = tile.querySelector(':scope > summary .ce-tile-title span');
                var label = ((span && span.textContent) || '').trim().replace(/^\d+\.?\s*/, '');
                if (label) items.push({ id: tile.id, label: label });
            }
        });

        if (items.length === 0) {
            nav.style.display = 'none';
            return;
        }
        nav.innerHTML = '';
        items.forEach(function (it) {
            var a = document.createElement('a');
            a.href = '#' + it.id;
            a.textContent = it.label;
            nav.appendChild(a);
        });
        nav.style.display = '';
    };

    function initPlutoHandbookUi() {
        patchWorkspaceBuild();
        patchBooleanSamples();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPlutoHandbookUi);
    } else {
        initPlutoHandbookUi();
    }
})();
