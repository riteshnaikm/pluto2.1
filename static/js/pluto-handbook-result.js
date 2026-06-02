/**
 * PLUTO Recruiter Handbook result workspace (Open Design).
 * Transforms rendered markdown into accordions, sourcing consoles, and recruiter controls.
 */
(function () {
    'use strict';

    var PLUTO_TIP_TEXT =
        'Prioritize evidence of production ownership before seniority title—incidents rolled back cleanly, rollout judgment, and on-call realism beat inflated IC levels in pooled markets.';

    function scrollToHandbookResult() {
        var el = document.getElementById('handbook-result-section');
        if (!el) return;
        var y = el.getBoundingClientRect().top + window.scrollY - 12;
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    }

    function isBooleanQuery(text) {
        if (!text || text.length < 12) return false;
        return (/\bAND\b|\bOR\b/i.test(text) && /[("]/.test(text)) || /site:|github\.com/i.test(text);
    }

    function looksLikeBooleanSample(text) {
        var t = stripLabelPrefix((text || '').replace(/\u00a0/g, ' ').trim());
        if (!t || t.length < 10 || t.length > 280) return false;
        if (isBooleanQuery(t)) return true;
        return /\([^)]+\)/.test(t) && /\b(AND|OR)\b/i.test(t);
    }

    function isLabelOnlyPlatformMarker(text) {
        var t = (text || '').replace(/\u00a0/g, ' ').trim();
        if (!t || t.length > 100) return false;
        return /^(LinkedIn|GitHub)\b.*?(?:string|search)\s*:?\s*$/i.test(t);
    }

    function isBooleanSamplesMarker(el) {
        var t = (el.textContent || '').replace(/\u00a0/g, ' ').trim();
        return /boolean\s+samples?/i.test(t) && t.length < 140;
    }

    function splitBooleanSamples(text) {
        var normalized = (text || '').replace(/\u00a0/g, ' ').trim();
        if (!normalized) return [];

        if (/Sample\s+\d+/i.test(normalized)) {
            var sampleChunks = normalized.split(/(?=Sample\s+\d+)/i).filter(function (c) {
                return c.trim();
            });
            return sampleChunks.map(function (chunk) {
                var m = chunk.match(/^Sample\s+\d+[^:]*:\s*/i);
                if (m) {
                    return {
                        label: m[0].replace(/:\s*$/, '').trim(),
                        query: chunk.slice(m[0].length).trim()
                    };
                }
                return { label: '', query: chunk.trim() };
            });
        }

        var numbered = normalized.split(/\n?(?=\s*\d+[.)]\s+)/).filter(function (c) {
            return c.trim();
        });
        if (numbered.length > 1) {
            return numbered.map(function (chunk, idx) {
                return {
                    label: 'Sample ' + (idx + 1),
                    query: stripLabelPrefix(chunk)
                };
            });
        }

        if (isBooleanQuery(normalized)) {
            return [{ label: '', query: stripLabelPrefix(normalized) }];
        }
        return [];
    }

    function isBooleanSearchHeading(el) {
        var t = (el.textContent || '').trim();
        return /boolean\s+search/i.test(t) || /boolean\s+samples?/i.test(t);
    }

    function extractInlineQuery(el) {
        if (!el) return '';
        var code = el.querySelector('code');
        if (code) return (code.textContent || '').replace(/\u00a0/g, ' ').trim();
        var tick = (el.textContent || '').match(/`([^`]+)`/);
        if (tick) return tick[1].replace(/\u00a0/g, ' ').trim();
        return (el.textContent || '').replace(/\u00a0/g, ' ').trim();
    }

    function stripLabelPrefix(text, labelHint) {
        var t = (text || '').replace(/\u00a0/g, ' ').trim();
        if (!t) return '';
        t = t.replace(/^\*+\s*|\s*\*+$/g, '');
        if (labelHint) {
            var re = new RegExp('^' + labelHint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*[:\\-–.]?\\s*', 'i');
            t = t.replace(re, '');
        }
        t = t.replace(/^(?:sample\s*\d+[^:]*:?\s*)/i, '');
        t = t.replace(/^\d+[.)]\s*/, '');
        return t.trim();
    }

    function unwrapBooleanConsoles(container) {
        Array.prototype.slice.call(container.querySelectorAll('.hb-boolean-samples-group')).forEach(function (group) {
            var lines = [];
            group.querySelectorAll('.hb-boolean-sample').forEach(function (row) {
                var label = row.querySelector('.hb-boolean-sample__label');
                var query = row.querySelector('.hb-boolean-sample__query');
                if (!query) return;
                var line = (label ? label.textContent.trim() + ': ' : '') + query.textContent.trim();
                lines.push(line);
            });
            var p = document.createElement('p');
            p.textContent = lines.join(' ');
            if (group.parentNode) group.parentNode.replaceChild(p, group);
        });
        Array.prototype.slice.call(container.querySelectorAll('.hb-sourcing-console, .hb-boolean-sample')).forEach(function (wrap) {
            var block = wrap.querySelector('.hb-boolean-sample__query, pre, code, p, li');
            if (block && wrap.parentNode) {
                if (block.classList.contains('hb-boolean-sample__query')) {
                    var restored = document.createElement('p');
                    restored.textContent = block.textContent;
                    wrap.parentNode.insertBefore(restored, wrap);
                } else {
                    block.classList.remove('hb-code');
                    wrap.parentNode.insertBefore(block, wrap);
                }
            }
            wrap.remove();
        });
    }

    function createBooleanSampleRow(label, query, assignAnchor) {
        var row = document.createElement('div');
        row.className = 'hb-boolean-sample';
        if (assignAnchor) row.id = 'hb-boolean-anchor';

        var toolbar = document.createElement('div');
        toolbar.className = 'hb-boolean-sample__toolbar';

        if (label) {
            var labelEl = document.createElement('span');
            labelEl.className = 'hb-boolean-sample__label';
            labelEl.textContent = label;
            toolbar.appendChild(labelEl);
        }

        var copyId = 'hb-boolean-' + Math.random().toString(36).slice(2, 9);
        var queryEl = document.createElement('div');
        queryEl.className = 'hb-boolean-sample__query hb-code';
        queryEl.id = copyId;
        queryEl.textContent = query;

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-outline-secondary btn-sm hb-copy-boolean-btn';
        btn.setAttribute('data-handbook-copy-target', copyId);
        btn.setAttribute('aria-label', label ? 'Copy ' + label : 'Copy boolean sample');
        btn.innerHTML = '<i class="bi bi-copy me-1" aria-hidden="true"></i><span class="hb-copy-label">Copy</span>';

        toolbar.appendChild(btn);
        row.appendChild(toolbar);
        row.appendChild(queryEl);
        return row;
    }

    function wrapBooleanSamplesInElement(el, assignAnchorRef) {
        if (!el || el.closest('.hb-boolean-sample, .hb-boolean-samples-group')) return false;
        var text = (el.textContent || '').replace(/\u00a0/g, ' ').trim();
        var samples = splitBooleanSamples(text);
        if (!samples.length) return false;

        var parent = el.parentNode;
        if (!parent) return false;

        if (samples.length === 1 && !samples[0].label) {
            var single = createBooleanSampleRow('', samples[0].query, assignAnchorRef.value);
            parent.insertBefore(single, el);
            el.remove();
            if (assignAnchorRef.value) assignAnchorRef.value = false;
            return true;
        }

        var group = document.createElement('div');
        group.className = 'hb-boolean-samples-group';
        samples.forEach(function (sample) {
            var row = createBooleanSampleRow(
                sample.label,
                sample.query,
                assignAnchorRef.value
            );
            group.appendChild(row);
            if (assignAnchorRef.value) assignAnchorRef.value = false;
        });
        parent.insertBefore(group, el);
        el.remove();
        return true;
    }

    function collectBooleanSearchBlocks(container) {
        var blocks = [];
        var seen = typeof WeakSet !== 'undefined' ? new WeakSet() : null;

        function add(node) {
            if (!node || node.closest('.hb-boolean-sample, .hb-boolean-samples-group')) return;
            if (seen && seen.has(node)) return;
            if (seen) seen.add(node);
            blocks.push(node);
        }

        function isBooleanBlockStop(el) {
            if (!el) return true;
            var tag = (el.tagName || '').toUpperCase();
            var text = (el.textContent || '').trim();
            if (tag === 'H2') return true;
            if (/^H[234]$/.test(tag)) {
                if (isBooleanSearchHeading(el)) return false;
                if (/sample\s+\d+/i.test(text)) return false;
                if (isPlatformSubheadingElement(el)) return true;
                if (isPlatformSourcingHeading(el)) return true;
                if (isPlatformSectionStopHeading(el)) return true;
            }
            return false;
        }

        container.querySelectorAll('h2, h3, h4').forEach(function (heading) {
            if (!isBooleanSearchHeading(heading)) return;
            var el = heading.nextElementSibling;
            while (el) {
                if (el.closest('.hb-boolean-sample, .hb-boolean-samples-group')) {
                    el = el.nextElementSibling;
                    continue;
                }
                var tag = (el.tagName || '').toUpperCase();
                var text = (el.textContent || '').trim();

                if (isBooleanBlockStop(el)) break;

                if (/^H[234]$/.test(tag) && /sample\s+\d+/i.test(text)) {
                    var sampleNodes = collectContentAfterSubheading(el);
                    if (sampleNodes.length) {
                        add(sampleNodes[0]);
                        if (sampleNodes.length > 1) {
                            sampleNodes.slice(1).forEach(add);
                        }
                    } else {
                        add(el);
                    }
                    el = el.nextElementSibling;
                    continue;
                }

                if (tag === 'P' || tag === 'PRE') {
                    if (/sample\s+\d+/i.test(text) || isBooleanQuery(text)) add(el);
                } else if (tag === 'UL' || tag === 'OL') {
                    el.querySelectorAll(':scope > li').forEach(function (li) {
                        if (/sample\s+\d+/i.test(li.textContent || '') || isBooleanQuery(li.textContent || '')) {
                            add(li);
                        }
                    });
                }
                el = el.nextElementSibling;
            }
        });

        container.querySelectorAll('p, li, pre, h3, h4').forEach(function (el) {
            var t = (el.textContent || '').trim();
            if (/sample\s+\d+/i.test(t) || (/^\d+[.)]\s+/.test(t) && isBooleanQuery(t))) {
                add(el);
            }
        });

        container.querySelectorAll('ol, ul').forEach(function (list) {
            if (list.closest('.hb-boolean-sample, .hb-boolean-samples-group')) return;
            var marker = list.previousElementSibling;
            var context = '';
            for (var i = 0; i < 4 && marker; i++) {
                context += ' ' + (marker.textContent || '');
                marker = marker.previousElementSibling;
            }
            if (!/boolean\s+samples?/i.test(context)) return;
            list.querySelectorAll(':scope > li').forEach(function (li) {
                if (isBooleanQuery(li.textContent || '')) add(li);
            });
        });

        return blocks;
    }

    function wrapBooleanListItem(li, label, assignAnchorRef) {
        if (!li || li.closest('.hb-boolean-sample')) return;
        var query = stripLabelPrefix(extractInlineQuery(li), label);
        if (!query || !looksLikeBooleanSample(query)) return;
        var row = createBooleanSampleRow(label || '', query, assignAnchorRef.value);
        if (assignAnchorRef.value) assignAnchorRef.value = false;
        li.parentNode.insertBefore(row, li);
        li.remove();
    }

    function isBooleanContentStop(el) {
        if (!el) return true;
        var tag = (el.tagName || '').toUpperCase();
        var text = (el.textContent || '').trim();
        if (tag === 'H2') return true;
        if (/^H[234]$/.test(tag)) {
            if (isBooleanSamplesMarker(el)) return false;
            if (isPlatformSubheadingElement(el) || isPlatformSourcingHeading(el)) return true;
            if (/likely companies|likely titles|red flags|sourcing mandate|recruiter checklist/i.test(text)) return true;
        }
        return false;
    }

    function upgradeBooleanSamplesAfterMarkers(container) {
        var assignAnchorRef = { value: true };
        container.querySelectorAll('h2, h3, h4, p, strong, b').forEach(function (marker) {
            if (!isBooleanSamplesMarker(marker)) return;
            var start = resolveSubheadingBlock(marker);
            var el = start.nextElementSibling;
            var sampleIdx = 0;

            while (el) {
                if (el.closest('.hb-boolean-sample, .hb-boolean-samples-group')) {
                    el = el.nextElementSibling;
                    continue;
                }
                if (isBooleanContentStop(el)) break;

                var tag = (el.tagName || '').toUpperCase();
                if (isBooleanSamplesMarker(el)) {
                    el = el.nextElementSibling;
                    continue;
                }

                if (tag === 'OL' || tag === 'UL') {
                    el.querySelectorAll(':scope > li').forEach(function (li) {
                        var qt = (li.textContent || '').trim();
                        if (!looksLikeBooleanSample(qt)) return;
                        sampleIdx += 1;
                        wrapBooleanListItem(li, 'Sample ' + sampleIdx, assignAnchorRef);
                    });
                } else if (tag === 'P' || tag === 'PRE') {
                    var text = (el.textContent || '').replace(/\u00a0/g, ' ').trim();
                    var samples = splitBooleanSamples(text);
                    if (samples.length > 1) {
                        var group = document.createElement('div');
                        group.className = 'hb-boolean-samples-group';
                        samples.forEach(function (sample, i) {
                            if (!looksLikeBooleanSample(sample.query)) return;
                            sampleIdx += 1;
                            var row = createBooleanSampleRow(
                                sample.label || 'Sample ' + sampleIdx,
                                sample.query,
                                assignAnchorRef.value
                            );
                            if (assignAnchorRef.value) assignAnchorRef.value = false;
                            group.appendChild(row);
                        });
                        if (group.children.length) {
                            el.parentNode.insertBefore(group, el);
                            el.remove();
                        }
                    } else if (looksLikeBooleanSample(text)) {
                        sampleIdx += 1;
                        var numMatch = text.match(/^(\d+)[.)]\s+/);
                        wrapBooleanListItem(
                            el,
                            numMatch ? 'Sample ' + numMatch[1] : 'Sample ' + sampleIdx,
                            assignAnchorRef
                        );
                    }
                }

                el = el.nextElementSibling;
            }
        });
    }

    function upgradePlatformStrategyParagraphs(container) {
        container.querySelectorAll('p, li').forEach(function (block) {
            if (block.closest('.hb-boolean-sample, .hb-boolean-samples-group, .hb-platform-sourcing-group')) return;
            var parsed = parseLabelAndQueryFromParagraph(block);
            if (!parsed || !parsed.query) return;
            if (!/linkedin|github/i.test(parsed.label)) return;
            insertPlatformCopyRow(block.parentNode, block, parsed.label, parsed.query);
            block.remove();
        });
    }

    function isLikelyLinkedinQuery(text) {
        return /site:\s*linkedin|linkedin\.com\/in|linkedin\.com\/pub|inurl:\s*linkedin/i.test(text || '');
    }

    function isLikelyGithubQuery(text) {
        var t = text || '';
        return (
            /github\.com\/search/i.test(t) ||
            /\blanguage:\s*["']?[a-z#.+][a-z#.+]*\b/i.test(t) ||
            /\bstars:\s*>/i.test(t) ||
            /\blocation:\s*"?[a-z]/i.test(t) ||
            /\brepo:|user:/i.test(t)
        );
    }

    function stripPlatformLabelPrefix(text, kind) {
        var t = normalizePlatformText(text);
        if (kind === 'github') {
            var gh = t.match(/^GitHub\s+search\s+string\s*:?\s*(.*)$/i);
            if (gh) return gh[1].trim();
        }
        if (kind === 'linkedin') {
            var li = t.match(/^LinkedIn\s+X[-\s]?ray\s+string\s*:?\s*(.*)$/i);
            if (li) return li[1].trim();
        }
        return t;
    }

    function expandFrameworkToken(token) {
        var t = (token || '').replace(/['"]/g, '').trim();
        if (!t) return '';
        var low = t.toLowerCase();
        if (/spring[\s-]?boot|springboot/.test(low)) {
            return '("spring boot" OR springboot OR "spring-boot")';
        }
        if (/\s/.test(t)) return '"' + t + '"';
        if (/-/.test(t)) return '("' + t.replace(/-/g, ' ') + '" OR ' + t + ')';
        return '"' + t + '"';
    }

    function parseGithubQueryTokens(raw) {
        var text = stripPlatformLabelPrefix(normalizePlatformText(raw), 'github');
        var out = {
            language: null,
            stars: null,
            location: null,
            followers: null,
            topics: [],
            raw: text,
            hasRepoQualifiers: false
        };
        if (!text) return out;

        var lang = text.match(/\blanguage:\s*([^\s]+)/i);
        if (lang) {
            out.language = lang[1].replace(/['"]/g, '');
            out.hasRepoQualifiers = true;
        }
        var stars = text.match(/\bstars:\s*([^\s]+)/i);
        if (stars) {
            out.stars = stars[1];
            out.hasRepoQualifiers = true;
        }
        var forks = text.match(/\bforks:\s*([^\s]+)/i);
        if (forks) out.hasRepoQualifiers = true;
        var loc = text.match(/\blocation:\s*"?([^"\s]+)"?/i);
        if (loc) out.location = loc[1];
        var fol = text.match(/\bfollowers:\s*([^\s]+)/i);
        if (fol) out.followers = fol[1];

        var quoted;
        var qRe = /"([^"]+)"/g;
        while ((quoted = qRe.exec(text)) !== null) {
            if (out.topics.indexOf(quoted[1]) === -1) out.topics.push(quoted[1]);
        }

        var lead = text.match(/^([a-z#+.]+)\s+language:/i);
        if (lead && out.topics.indexOf(lead[1]) === -1) out.topics.push(lead[1]);

        text.replace(/\b([a-z][a-z0-9]*-[a-z][a-z0-9]*)\b/gi, function (m) {
            if (out.topics.indexOf(m) === -1 && !/^(language|stars|location|followers)$/i.test(m)) {
                out.topics.push(m);
            }
            return m;
        });

        if (!out.topics.length && out.language) out.topics.push(out.language);
        return out;
    }

    function buildGithubRepositoryQuery(parsed) {
        var parts = [];
        parsed.topics.forEach(function (t) {
            var expanded = expandFrameworkToken(t);
            parts.push(expanded || '"' + t + '"');
        });
        if (parsed.language) parts.push('language:' + parsed.language);
        if (parsed.stars) parts.push('stars:' + parsed.stars);
        if (parsed.location) parts.push('location:' + parsed.location);
        if (!parts.length && parsed.raw) return parsed.raw;
        return parts.join(' ');
    }

    function buildGithubUserQuery(parsed) {
        var parts = [];
        var kw = parsed.topics
            .map(function (t) {
                return t.replace(/-/g, ' ').replace(/['"]/g, '');
            })
            .join(' ')
            .trim();
        if (kw) parts.push(kw);
        if (parsed.location) parts.push('location:' + parsed.location);
        parts.push(parsed.followers ? 'followers:' + parsed.followers : 'followers:>10');
        return parts.join(' ');
    }

    function githubSearchUrl(q, type) {
        return 'https://github.com/search?q=' + encodeURIComponent(q) + '&type=' + type;
    }

    function buildGithubSearchUrls(rawQuery) {
        var q = stripPlatformLabelPrefix(normalizePlatformText(rawQuery), 'github');
        if (!q) return [];

        if (/^https?:\/\/github\.com\/search/i.test(q)) {
            try {
                var u = new URL(q);
                var type = (u.searchParams.get('type') || 'users').toLowerCase();
                var inner = decodeURIComponent((u.searchParams.get('q') || '').replace(/\+/g, ' '));
                if (type === 'users' && /\b(language:|stars:|forks:)/i.test(inner)) {
                    return buildGithubSearchUrls(inner);
                }
                if (type === 'repositories') {
                    return [{ label: 'GitHub — Repos (recommended)', url: q, variant: 'repos' }];
                }
                return [{ label: 'GitHub — Users', url: q, variant: 'users' }];
            } catch (err) {
                return [{ label: 'GitHub search', url: q, variant: 'link' }];
            }
        }

        var parsed = parseGithubQueryTokens(q);
        var rows = [];
        var repoQ = buildGithubRepositoryQuery(parsed);
        if (repoQ) {
            rows.push({
                label: 'GitHub — Repos (recommended)',
                url: githubSearchUrl(repoQ, 'repositories'),
                variant: 'repos'
            });
        }
        var userQ = buildGithubUserQuery(parsed);
        if (userQ) {
            rows.push({
                label: 'GitHub — Users (profiles)',
                url: githubSearchUrl(userQ, 'users'),
                variant: 'users'
            });
        }
        return rows;
    }

    function insertGithubSourcingGroup(parent, beforeNode, rawQuery, assignAnchorRef) {
        var items = buildGithubSearchUrls(rawQuery);
        if (!items.length || !parent) return;

        var group = document.createElement('div');
        group.className = 'hb-boolean-samples-group hb-platform-sourcing-group hb-github-sourcing-group';

        items.forEach(function (item, idx) {
            var row = createBooleanSampleRow(
                item.label,
                item.url,
                !!(assignAnchorRef && assignAnchorRef.value && idx === 0)
            );
            if (assignAnchorRef && assignAnchorRef.value) assignAnchorRef.value = false;
            group.appendChild(row);
        });

        var hint = document.createElement('p');
        hint.className = 'hb-github-sourcing-hint';
        hint.textContent =
            'Use Repos first (owners & contributors), then Users for a profile pass. Repo qualifiers (language:, stars:) do not map cleanly to type=users.';
        group.appendChild(hint);

        parent.insertBefore(group, beforeNode || null);
        if (beforeNode && beforeNode.parentNode) beforeNode.remove();
    }

    function platformQueryForCopy(label, query) {
        var q = normalizePlatformText(query);
        if (/github/i.test(label || '')) {
            var rows = buildGithubSearchUrls(q);
            return rows.length ? rows[0].url : '';
        }
        if (/linkedin/i.test(label || '')) {
            return stripPlatformLabelPrefix(q, 'linkedin');
        }
        return q;
    }

    function nodeHasCopyUI(node) {
        return !!(node && node.closest && node.closest('.hb-boolean-sample, .hb-platform-sourcing-group'));
    }

    function extractPlatformQueryFromBlock(el) {
        var text = normalizePlatformText(el.textContent);
        if (!text || isPlatformLabelOnlyText(text)) return null;

        var ghRemainder = stripPlatformLabelPrefix(text, 'github');
        if (ghRemainder !== text && ghRemainder.length >= 12 && isLikelyGithubQuery(ghRemainder)) {
            return { label: 'GitHub search', query: ghRemainder };
        }
        var liRemainder = stripPlatformLabelPrefix(text, 'linkedin');
        if (liRemainder !== text && liRemainder.length >= 12 && isLikelyLinkedinQuery(liRemainder)) {
            return { label: 'LinkedIn X-Ray', query: liRemainder };
        }

        var labeled = text.match(/^(LinkedIn\s+X[-\s]?ray\s+string|GitHub\s+search\s+string)\s*:?\s*(.+)$/i);
        if (labeled) {
            var q = labeled[2].trim();
            if (q.length < 12 || isPlatformLabelOnlyText(q)) return null;
            return {
                label: /linkedin/i.test(labeled[1]) ? 'LinkedIn X-Ray' : 'GitHub search',
                query: q
            };
        }
        if (isLikelyLinkedinQuery(text) && !looksLikeBooleanSample(text)) {
            return { label: 'LinkedIn X-Ray', query: text };
        }
        if (isLikelyGithubQuery(text) && !looksLikeBooleanSample(text)) {
            return { label: 'GitHub search', query: text };
        }
        return null;
    }

    function wrapQueryCopyRow(parent, beforeNode, label, query, assignAnchorRef) {
        if (!parent || !query || nodeHasCopyUI(beforeNode)) return;
        if (/github/i.test(label || '')) {
            insertGithubSourcingGroup(parent, beforeNode, query, assignAnchorRef);
            return;
        }
        var q = platformQueryForCopy(label, query);
        if (q.length < 10) return;
        var isPlatform = label && /linkedin/i.test(label);
        var row = createBooleanSampleRow(label || '', q, !!(assignAnchorRef && assignAnchorRef.value));
        if (assignAnchorRef && assignAnchorRef.value) assignAnchorRef.value = false;
        var group = document.createElement('div');
        group.className = isPlatform
            ? 'hb-boolean-samples-group hb-platform-sourcing-group'
            : 'hb-boolean-samples-group';
        group.appendChild(row);
        parent.insertBefore(group, beforeNode || null);
        if (beforeNode && beforeNode.parentNode) beforeNode.remove();
    }

    function upgradeStandalonePlatformQueries(container) {
        container.querySelectorAll('p, pre, li').forEach(function (el) {
            if (nodeHasCopyUI(el)) return;
            var text = normalizePlatformText(el.textContent);
            if (!text || isBooleanSamplesMarker(el) || isPlatformLabelOnlyText(text)) return;
            if (/^adjacency\b/i.test(text) || /^likely companies\b|^likely titles\b/i.test(text)) return;
            if (/^platform\s+strateg/i.test(text) && text.length < 80) return;
            var parsed = extractPlatformQueryFromBlock(el);
            if (!parsed || isAdjacentPlatformLabel(parsed.label)) return;
            wrapQueryCopyRow(el.parentNode, el, parsed.label, parsed.query, null);
        });
    }

    function upgradePlatformLabelThenPrePairs(container) {
        container.querySelectorAll('p, li, h3, h4').forEach(function (block) {
            if (block.closest('.hb-boolean-sample, .hb-boolean-samples-group, .hb-platform-sourcing-group')) return;
            if (!isPlatformLabelOnlyText(block.textContent)) return;
            var label = platformLabelFromMarkerText(block.textContent);
            var next = block.nextElementSibling;
            if (!next) return;
            var tag = (next.tagName || '').toUpperCase();
            if (tag !== 'PRE' && tag !== 'P') return;
            var query = normalizePlatformText(next.textContent);
            if (!query || query.length < 12 || isPlatformLabelOnlyText(query)) return;
            if (/linkedin/i.test(label) && !isLikelyLinkedinQuery(query)) return;
            if (/github/i.test(label) && !isLikelyGithubQuery(query)) return;
            insertPlatformCopyRow(block.parentNode, block, label, query);
            block.remove();
            next.remove();
        });
    }

    function dedupePlatformCopyRows(container) {
        var seenLinkedin = false;
        var seenGithubUrls = {};
        Array.prototype.slice
            .call(container.querySelectorAll('.hb-platform-sourcing-group'))
            .forEach(function (group) {
                if (group.classList.contains('hb-github-sourcing-group')) {
                    return;
                }
                var labelEl = group.querySelector('.hb-boolean-sample__label');
                var queryEl = group.querySelector('.hb-boolean-sample__query');
                var labelText = (labelEl && labelEl.textContent) || '';
                var queryText = ((queryEl && queryEl.textContent) || '').trim();
                if (!queryText || queryText.length < 12 || isPlatformLabelOnlyText(queryText)) {
                    group.remove();
                    return;
                }
                if (/linkedin/i.test(labelText)) {
                    if (!isLikelyLinkedinQuery(queryText)) {
                        group.remove();
                        return;
                    }
                    if (seenLinkedin) {
                        group.remove();
                        return;
                    }
                    seenLinkedin = true;
                }
                if (/github/i.test(labelText)) {
                    if (!/github\.com\/search/i.test(queryText)) {
                        group.remove();
                        return;
                    }
                    if (seenGithubUrls[queryText]) {
                        group.remove();
                        return;
                    }
                    seenGithubUrls[queryText] = true;
                }
            });
    }

    function upgradePlatformCopyBlocks(container) {
        upgradePlatformLabelWithFollowingQuery(container);
        upgradePlatformLabelThenPrePairs(container);
        upgradeStandalonePlatformQueries(container);
        upgradePlatformStrategyParagraphs(container);
        dedupePlatformCopyRows(container);
    }

    function shouldStopBooleanSiblingScan(el) {
        if (!el) return true;
        var tag = (el.tagName || '').toUpperCase();
        var text = normalizePlatformText(el.textContent);
        if (tag === 'H2') return true;
        if (!/^H[234]$/.test(tag)) return false;
        if (isBooleanSamplesMarker(el)) return false;
        return (
            /sourcing mandate|red flags|recruiter checklist|overqualification|likely companies|likely titles/i.test(
                text
            ) || isPlatformSourcingHeading(el)
        );
    }

    function upgradeAllBooleanSampleLines(container) {
        var assignAnchorRef = { value: true };
        container.querySelectorAll('h2, h3, h4, p, strong, b, li').forEach(function (marker) {
            if (!isBooleanSamplesMarker(marker)) return;
            var start = resolveSubheadingBlock(marker);
            var el = start.nextElementSibling;
            var sampleIdx = 0;

            while (el) {
                if (nodeHasCopyUI(el)) {
                    el = el.nextElementSibling;
                    continue;
                }
                if (shouldStopBooleanSiblingScan(el)) break;
                if (isBooleanSamplesMarker(el)) {
                    el = el.nextElementSibling;
                    continue;
                }

                var tag = (el.tagName || '').toUpperCase();
                var text = normalizePlatformText(el.textContent);

                if (/^adjacency\b/i.test(text)) {
                    el = el.nextElementSibling;
                    continue;
                }

                if (tag === 'OL' || tag === 'UL') {
                    el.querySelectorAll(':scope > li').forEach(function (li) {
                        if (nodeHasCopyUI(li)) return;
                        var qt = stripLabelPrefix(li.textContent || '');
                        if (!looksLikeBooleanSample(qt) || isLikelyLinkedinQuery(qt)) return;
                        sampleIdx += 1;
                        wrapQueryCopyRow(li.parentNode, li, 'Sample ' + sampleIdx, qt, assignAnchorRef);
                    });
                } else if (tag === 'P' || tag === 'PRE') {
                    if (extractPlatformQueryFromBlock(el)) {
                        el = el.nextElementSibling;
                        continue;
                    }
                    var lines = text
                        .split(/\n|<br\s*\/?>/gi)
                        .map(function (line) {
                            return stripLabelPrefix(line);
                        })
                        .filter(Boolean);
                    var boolLines = lines.filter(function (line) {
                        return looksLikeBooleanSample(line) && !isLikelyLinkedinQuery(line);
                    });
                    if (boolLines.length > 1) {
                        var group = document.createElement('div');
                        group.className = 'hb-boolean-samples-group';
                        boolLines.forEach(function (line) {
                            sampleIdx += 1;
                            group.appendChild(
                                createBooleanSampleRow('Sample ' + sampleIdx, line, assignAnchorRef.value)
                            );
                            if (assignAnchorRef.value) assignAnchorRef.value = false;
                        });
                        el.parentNode.insertBefore(group, el);
                        el.remove();
                    } else if (looksLikeBooleanSample(text) && !isLikelyLinkedinQuery(text)) {
                        sampleIdx += 1;
                        var numMatch = text.match(/^(\d+)[.)]\s+/);
                        wrapQueryCopyRow(
                            el.parentNode,
                            el,
                            numMatch ? 'Sample ' + numMatch[1] : 'Sample ' + sampleIdx,
                            stripLabelPrefix(text),
                            assignAnchorRef
                        );
                    }
                }

                el = el.nextElementSibling;
            }
        });

        container.querySelectorAll('p, li, pre').forEach(function (el) {
            if (nodeHasCopyUI(el)) return;
            var text = stripLabelPrefix(normalizePlatformText(el.textContent));
            if (!looksLikeBooleanSample(text) || isLikelyLinkedinQuery(text)) return;
            var ctx = '';
            var prev = el;
            for (var i = 0; i < 10 && prev; i++) {
                ctx += ' ' + (prev.textContent || '');
                prev = prev.previousElementSibling;
            }
            if (!/boolean\s+samples?/i.test(ctx)) return;
            sampleIdx = container.querySelectorAll('.hb-boolean-sample').length;
            wrapQueryCopyRow(el.parentNode, el, 'Sample ' + (sampleIdx + 1), text, assignAnchorRef);
        });
    }

    function upgradeNumberedBooleanParagraphs(container) {
        var assignAnchorRef = { value: false };
        container.querySelectorAll('p, li').forEach(function (el) {
            if (el.closest('.hb-boolean-sample, .hb-boolean-samples-group')) return;
            var text = (el.textContent || '').replace(/\u00a0/g, ' ').trim();
            if (!/^\d+[.)]\s+/.test(text) || !isBooleanQuery(text)) return;
            var numMatch = text.match(/^(\d+)[.)]\s+/);
            wrapBooleanListItem(el, numMatch ? 'Sample ' + numMatch[1] : '', assignAnchorRef);
        });
    }

    function isPlatformSourcingHeading(el) {
        var t = (el.textContent || '').trim();
        return /platform[-\s]*specific\s+sourcing/i.test(t) || /^platform\s+strateg/i.test(t);
    }

    function classifyPlatformSubheading(text) {
        var raw = (text || '').replace(/\u00a0/g, ' ').trim();
        var t = raw.toLowerCase();
        if (!t || t.length > 160) return null;
        if (/adjacent\s+skills?|skill\s+adjacenc|alternative\s+skills?|^adjacency\b/i.test(t)) {
            return 'Adjacent Skills';
        }
        if (/github\s+search|github\s+search\s+string|github\s+user\s+search|^github\b/i.test(t)) {
            return 'GitHub search';
        }
        if (/linkedin\s+x[-\s]?ray|linkedin\s+x-ray\s+string|linkedin\s+search\s+string|^linkedin\b/i.test(t)) {
            return 'LinkedIn X-Ray';
        }
        return null;
    }

    function isPlatformSubheadingElement(el) {
        if (!el || el.closest('.hb-boolean-sample, .hb-boolean-samples-group')) return false;
        var tag = (el.tagName || '').toUpperCase();
        if (tag === 'STRONG' || tag === 'B') {
            var parentTag = el.parentElement && el.parentElement.tagName;
            if (parentTag === 'P' || parentTag === 'LI') return false;
        }
        if (!/^H[234]$/.test(tag) && tag !== 'P' && tag !== 'STRONG' && tag !== 'B' && tag !== 'LI') return false;
        if (isLabelOnlyPlatformMarker(el.textContent)) return false;
        return !!classifyPlatformSubheading(el.textContent);
    }

    function isAdjacentPlatformLabel(label) {
        return /^adjacent\s+skills?$/i.test((label || '').trim());
    }

    function insertPlatformCopyRow(parent, beforeNode, label, query) {
        if (isAdjacentPlatformLabel(label)) return;
        wrapQueryCopyRow(parent, beforeNode, label, query, null);
    }

    function isPlatformSectionStopHeading(el) {
        var t = (el.textContent || '').trim();
        if (/boolean\s+search/i.test(t)) return true;
        if (/boolean\s+samples?/i.test(t)) return true;
        if (/likely companies|likely titles/i.test(t)) return true;
        if (/red flags|screening framework|recruiter checklist|recruiter sales/i.test(t)) return true;
        if (/overqualification/i.test(t)) return true;
        return false;
    }

    function normalizePlatformText(text) {
        return (text || '')
            .replace(/\u00a0/g, ' ')
            .replace(/[\u2010-\u2015\u2212]/g, '-')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function isPlatformLabelOnlyText(text) {
        var t = normalizePlatformText(text);
        return /^(LinkedIn\s+X[-\s]?ray\s+string|GitHub\s+search\s+string)\s*:?\s*$/i.test(t);
    }

    function platformLabelFromMarkerText(text) {
        return /linkedin/i.test(text || '') ? 'LinkedIn X-Ray' : 'GitHub search';
    }

    function findFollowingPlatformQuery(startEl) {
        var el = startEl.nextElementSibling;
        var steps = 0;
        while (el && steps < 5) {
            if (nodeHasCopyUI(el)) return null;
            var tag = (el.tagName || '').toUpperCase();
            var text = normalizePlatformText(el.textContent);
            if (!text) {
                el = el.nextElementSibling;
                steps += 1;
                continue;
            }
            if (isPlatformLabelOnlyText(text)) {
                el = el.nextElementSibling;
                steps += 1;
                continue;
            }
            if (tag === 'P' || tag === 'PRE' || tag === 'LI') {
                if (isLikelyLinkedinQuery(text)) {
                    return { node: el, label: 'LinkedIn X-Ray', query: text };
                }
                if (isLikelyGithubQuery(text) && !looksLikeBooleanSample(text)) {
                    return { node: el, label: 'GitHub search', query: text };
                }
                var inline = extractPlatformQueryFromBlock(el);
                if (inline && inline.query && !isPlatformLabelOnlyText(inline.query)) {
                    return { node: el, label: inline.label, query: inline.query };
                }
            }
            el = el.nextElementSibling;
            steps += 1;
        }
        return null;
    }

    function upgradePlatformLabelWithFollowingQuery(container) {
        container.querySelectorAll('p, li, h3, h4').forEach(function (block) {
            if (nodeHasCopyUI(block)) return;
            var blockEl = resolveSubheadingBlock(block);
            if (!isPlatformLabelOnlyText(blockEl.textContent)) return;
            var label = platformLabelFromMarkerText(blockEl.textContent);
            var follow = findFollowingPlatformQuery(blockEl);
            if (!follow || !follow.query) return;
            var parent = blockEl.parentNode;
            if (!parent) return;
            wrapQueryCopyRow(parent, blockEl, label, follow.query, null);
            if (follow.node && follow.node.parentNode) follow.node.remove();
        });
    }

    function extractCopyTextFromPlatformNodes(nodes) {
        var lines = [];
        nodes.forEach(function (node) {
            var tag = (node.tagName || '').toUpperCase();
            if (tag === 'UL' || tag === 'OL') {
                node.querySelectorAll(':scope > li').forEach(function (li) {
                    var line = normalizePlatformText(li.textContent);
                    if (line) lines.push(line.replace(/^[-*•]\s+/, ''));
                });
            } else if (tag === 'LI') {
                var liLine = normalizePlatformText(node.textContent);
                if (liLine) lines.push(liLine.replace(/^[-*•]\s+/, ''));
            } else {
                var blockText = normalizePlatformText(node.textContent);
                if (blockText) lines.push(blockText);
            }
        });
        return lines.join('\n').trim();
    }

    function parseLabelAndQueryFromParagraph(el) {
        var text = (el.textContent || '').replace(/\u00a0/g, ' ').trim();
        if (!text) return null;
        var labeled = text.match(/^(LinkedIn\s+X[-\s]?ray\s+string|GitHub\s+search\s+string)\s*:?\s*(.+)$/i);
        if (labeled) {
            return {
                label: /linkedin/i.test(labeled[1]) ? 'LinkedIn X-Ray' : 'GitHub search',
                query: labeled[2].trim()
            };
        }
        var m = text.match(
            /^(LinkedIn(?:\s+X[-\s]?Ray)?(?:\s+\w+){0,6}|GitHub(?:\s+(?:User\s+)?)?(?:\s+Search)?(?:\s+\w+){0,6}|Adjacent\s+Skills?)\s*[:.\-–]\s*(.+)$/i
        );
        if (m) {
            return {
                label: classifyPlatformSubheading(m[1]) || m[1].trim(),
                query: m[2].trim()
            };
        }
        return null;
    }

    function isPlatformBlockStopElement(el) {
        if (!el) return true;
        var tag = (el.tagName || '').toUpperCase();
        var text = (el.textContent || '').trim();
        if (tag === 'H2') return true;
        if (/^H[234]$/.test(tag)) {
            if (isBooleanSearchHeading(el)) return true;
            if (isPlatformSectionStopHeading(el)) return true;
            if (/sample\s+\d+/i.test(text)) return true;
            if (isPlatformSubheadingElement(el)) return true;
        }
        return false;
    }

    function resolveSubheadingBlock(el) {
        if (!el) return el;
        var tag = (el.tagName || '').toUpperCase();
        if ((tag === 'STRONG' || tag === 'B') && el.parentElement && el.parentElement.tagName === 'P') {
            return el.parentElement;
        }
        return el;
    }

    function collectContentAfterSubheading(startEl) {
        var nodes = [];
        var block = resolveSubheadingBlock(startEl);
        var el = block.nextElementSibling;
        while (el) {
            if (el.closest('.hb-boolean-sample, .hb-boolean-samples-group')) break;
            if (isPlatformBlockStopElement(el)) break;
            var tag = (el.tagName || '').toUpperCase();
            if (tag === 'P' || tag === 'PRE' || tag === 'UL' || tag === 'OL') {
                nodes.push(el);
            }
            el = el.nextElementSibling;
        }
        return nodes;
    }

    function collectPlatformSourcingItems(container) {
        var items = [];
        var claimed = typeof WeakSet !== 'undefined' ? new WeakSet() : null;

        function claimItem(item) {
            var taken = false;
            item.nodes.forEach(function (n) {
                if (claimed && claimed.has(n)) taken = true;
            });
            if (taken) return;
            item.nodes.forEach(function (n) {
                if (claimed) claimed.add(n);
            });
            items.push(item);
        }

        function addFromSubheading(subEl, label) {
            if (!subEl || subEl.closest('.hb-boolean-sample, .hb-boolean-samples-group')) return;
            var blockEl = resolveSubheadingBlock(subEl);
            if (isLabelOnlyPlatformMarker(blockEl.textContent)) return;
            var parsed = parseLabelAndQueryFromParagraph(blockEl);
            if (parsed && parsed.query && !isAdjacentPlatformLabel(parsed.label)) {
                claimItem({ label: parsed.label, nodes: [blockEl], query: parsed.query });
            }
        }

        container.querySelectorAll('h2, h3, h4, p, li, strong, b').forEach(function (el) {
            if (!isPlatformSubheadingElement(el)) return;
            var label = classifyPlatformSubheading(el.textContent);
            if (!label) return;
            addFromSubheading(el, label);
        });

        return items;
    }

    function wrapPlatformSourcingItems(container) {
        collectPlatformSourcingItems(container).forEach(function (item) {
            if (!item.nodes.length || !item.query) return;
            if (isAdjacentPlatformLabel(item.label)) return;
            if (item.nodes.some(function (n) { return n.closest('.hb-boolean-sample'); })) return;

            var anchor = item.nodes[0];
            if (!anchor || !anchor.parentNode) return;
            insertPlatformCopyRow(anchor.parentNode, anchor, item.label, item.query);
            item.nodes.forEach(function (n) {
                if (n.parentNode) n.remove();
            });
        });
    }

    function upgradePlatformSourcing(container) {
        wrapPlatformSourcingItems(container);
    }

    function unwrapWorkspace(container) {
        if (!container) return;
        unwrapBooleanConsoles(container);
        container.querySelectorAll('.hb-pluto-tip').forEach(function (el) {
            el.remove();
        });
        container.querySelectorAll('.hb-title-row, .hb-handbook-sticky-controls').forEach(function (el) {
            el.remove();
        });
        Array.prototype.slice.call(container.querySelectorAll('details.hb-acc')).forEach(function (det) {
            var body = det.querySelector('.hb-acc-body');
            var h2 = det.querySelector('summary h2');
            var parent = det.parentNode;
            if (!parent) return;
            if (h2) {
                parent.insertBefore(h2, det);
            }
            if (body) {
                while (body.firstChild) {
                    parent.insertBefore(body.firstChild, det);
                }
            }
            det.remove();
        });
        delete container.dataset.workspaceBuilt;
    }

    function wrapTables(container) {
        container.querySelectorAll('table').forEach(function (table) {
            if (table.closest('.hb-table-wrap')) return;
            var wrap = document.createElement('div');
            wrap.className = 'hb-table-wrap';
            table.parentNode.insertBefore(wrap, table);
            wrap.appendChild(table);
        });
        container.querySelectorAll('.hb-table-wrap').forEach(function (w) {
            if (w.tagName !== 'DIV') {
                var d = document.createElement('div');
                d.className = w.className;
                while (w.firstChild) d.appendChild(w.firstChild);
                w.parentNode.replaceChild(d, w);
            }
        });
    }

    function splitSections(container) {
        var intro = [];
        var sections = [];
        var current = null;

        function isChromeNode(node) {
            return (
                node.classList &&
                (node.classList.contains('hb-title-row') || node.classList.contains('hb-handbook-sticky-controls'))
            );
        }

        function flushSection() {
            if (current) {
                sections.push(current);
                current = null;
            }
        }

        function adoptHeading(h2) {
            flushSection();
            current = { heading: h2, nodes: [] };
        }

        Array.prototype.forEach.call(container.children, function (node) {
            if (isChromeNode(node)) return;

            if (node.matches && node.matches('h2')) {
                adoptHeading(node);
                return;
            }

            var innerH2 = node.querySelector && node.querySelector(':scope > h2, h2');
            if (innerH2 && !current) {
                var rest = [];
                Array.prototype.forEach.call(node.childNodes, function (child) {
                    if (child.nodeType === 1 && child.tagName === 'H2') {
                        adoptHeading(child);
                    } else if (child.nodeType === 1) {
                        if (current) rest.push(child);
                        else intro.push(child);
                    }
                });
                if (current && rest.length) {
                    current.nodes.push.apply(current.nodes, rest);
                }
                return;
            }

            if (current) {
                current.nodes.push(node);
            } else {
                intro.push(node);
            }
        });

        flushSection();
        return { intro: intro, sections: sections };
    }

    function buildTitleRow(sectionCount) {
        if (!sectionCount) return null;

        var row = document.createElement('div');
        row.className = 'hb-title-row hb-title-row--toc-only';

        var toc = document.createElement('div');
        toc.className = 'hb-toc-mini';
        toc.innerHTML = '<strong>Mini TOC · </strong>';
        for (var i = 0; i < sectionCount; i++) {
            if (i > 0) toc.appendChild(document.createTextNode(' · '));
            var a = document.createElement('a');
            a.href = '#hb-sec-' + i;
            a.setAttribute('data-hb-target', 'hb-sec-' + i);
            a.textContent = String(i);
            toc.appendChild(a);
        }
        row.appendChild(toc);
        return row;
    }

    function buildStickyControls() {
        var bar = document.createElement('div');
        bar.className = 'hb-handbook-sticky-controls';
        bar.setAttribute('role', 'toolbar');
        bar.setAttribute('aria-label', 'Handbook section controls');
        bar.innerHTML =
            '<button type="button" id="hb-expand-all" class="btn btn-link btn-sm">Expand all</button>' +
            '<span class="hb-controls-sep" aria-hidden="true">/</span>' +
            '<button type="button" id="hb-collapse-all" class="btn btn-link btn-sm">Collapse all</button>' +
            '<a href="#hb-boolean-anchor" class="hb-jump-boolean" data-hb-target="hb-boolean-anchor">Jump to Boolean</a>';
        return bar;
    }

    function wrapInAccordions(container, sections) {
        sections.forEach(function (sec, idx) {
            var h2 = sec.heading;
            h2.id = 'hb-sec-' + idx;
            var details = document.createElement('details');
            details.className = 'hb-acc';
            if (idx < 2) details.open = true;

            var summary = document.createElement('summary');
            summary.className = 'hb-acc-summary';
            var chev = document.createElement('span');
            chev.className = 'hb-acc-chevron';
            chev.setAttribute('aria-hidden', 'true');
            chev.innerHTML = '<i class="bi bi-chevron-down"></i>';
            summary.appendChild(chev);
            summary.appendChild(h2);

            var body = document.createElement('div');
            body.className = 'hb-acc-body';
            sec.nodes.forEach(function (n) {
                body.appendChild(n);
            });

            details.appendChild(summary);
            details.appendChild(body);
            container.appendChild(details);
        });
    }

    function upgradeBooleanConsoles(container) {
        unwrapBooleanConsoles(container);
        upgradePlatformCopyBlocks(container);
        upgradeAllBooleanSampleLines(container);
    }

    function injectPlutoTip(container) {
        if (container.querySelector('.hb-pluto-tip')) return;
        var accs = container.querySelectorAll('details.hb-acc');
        var target = null;
        Array.prototype.forEach.call(accs, function (det) {
            var h2 = det.querySelector('summary h2');
            if (h2 && /primary\s+sourcing|must-have/i.test(h2.textContent || '')) {
                target = det.querySelector('.hb-acc-body');
            }
        });
        if (!target) return;
        var tip = document.createElement('p');
        tip.className = 'hb-pluto-tip';
        tip.setAttribute('role', 'note');
        tip.textContent = PLUTO_TIP_TEXT;
        var table = target.querySelector('.hb-table-wrap, table');
        if (table && table.parentNode) {
            table.parentNode.insertBefore(tip, table.nextSibling);
        } else {
            target.insertBefore(tip, target.firstChild);
        }
    }

    function bindCopyButtons(root) {
        root.querySelectorAll('[data-handbook-copy-target]').forEach(function (btn) {
            if (btn.dataset.hbCopyBound === '1') return;
            btn.dataset.hbCopyBound = '1';
            btn.addEventListener('click', function () {
                var tid = btn.getAttribute('data-handbook-copy-target');
                var pre = tid && document.getElementById(tid);
                if (!pre) return;
                var text = pre.textContent || '';
                var labelEl = btn.querySelector('.hb-copy-label');

                function flash(ok) {
                    if (labelEl) {
                        var prev = labelEl.textContent;
                        labelEl.textContent = ok ? 'Copied' : 'Retry';
                        setTimeout(function () {
                            labelEl.textContent = prev || 'Copy';
                        }, 1400);
                    }
                }

                function done(ok) {
                    flash(ok);
                }

                if (window.copyToClipboard) {
                    window.copyToClipboard(text, btn);
                    return;
                }
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).then(function () {
                        done(true);
                    }).catch(function () {
                        done(false);
                    });
                }
            });
        });
    }

    function openAncestorDetails(el) {
        var node = el;
        while (node) {
            if (node.tagName === 'DETAILS' && !node.open) {
                node.open = true;
            }
            node = node.parentElement;
        }
    }

    function isHandbookResultVisible() {
        var section = document.getElementById('handbook-result-section');
        if (!section) return false;
        if (section.style.display === 'none') return false;
        return section.offsetParent !== null || section.getBoundingClientRect().height > 0;
    }

    function scrollToHandbookTarget(el) {
        if (!el) return;
        var scrollEl = (el.closest && el.closest('details.hb-acc')) || el;
        openAncestorDetails(scrollEl);
        window.setTimeout(function () {
            if (scrollEl.scrollIntoView) {
                scrollEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
                var pad = 130;
                var y = scrollEl.getBoundingClientRect().top + window.scrollY - pad;
                window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
            }
        }, 80);
    }

    function resolveHandbookHashTarget(hash, container) {
        if (!hash || hash.charAt(0) !== '#') return null;
        var id = decodeURIComponent(hash.slice(1));
        var target = document.getElementById(id);
        if (target) return target;

        if (/^hb-sec-\d+$/i.test(id) && container) {
            target = container.querySelector('#' + id);
            if (target) return target;
        }

        if (id === 'hb-boolean-anchor' && container) {
            return (
                container.querySelector('#hb-boolean-anchor') ||
                container.querySelector('.hb-boolean-sample')
            );
        }
        return null;
    }

    function navigateHandbookHash(hash, container) {
        var target = resolveHandbookHashTarget(hash, container);
        if (!target) return false;
        scrollToHandbookTarget(target);
        return true;
    }

    function ensureBooleanAnchor(container) {
        if (container.querySelector('#hb-boolean-anchor')) return;
        var talentDet = Array.prototype.find.call(
            container.querySelectorAll('details.hb-acc'),
            function (det) {
                var h2 = det.querySelector('summary h2');
                return h2 && /talent|sourcing|boolean/i.test(h2.textContent || '');
            }
        );
        var scope = talentDet ? talentDet.querySelector('.hb-acc-body') : container;
        var block =
            scope.querySelector('#hb-boolean-anchor') ||
            scope.querySelector('.hb-boolean-sample') ||
            scope.querySelector('pre');
        if (!block) return;
        if (!block.id) block.id = 'hb-boolean-anchor';
    }

    function handleHandbookResultClick(e) {
        if (!isHandbookResultVisible()) return;
        var section = document.getElementById('handbook-result-section');
        var container = document.getElementById('handbook-content');
        if (!section || !container || !section.contains(e.target)) return;

        var navLink = e.target.closest && e.target.closest('[data-hb-target], a.hb-jump-boolean, a[href^="#hb-sec-"], a[href="#hb-boolean-anchor"]');
        if (navLink && section.contains(navLink)) {
            var targetId = navLink.getAttribute('data-hb-target') || (navLink.getAttribute('href') || '').replace(/^#/, '');
            if (targetId) {
                e.preventDefault();
                if (targetId === 'hb-boolean-anchor') ensureBooleanAnchor(container);
                navigateHandbookHash('#' + targetId, container);
                return;
            }
        }

        var expandBtn = e.target.closest && e.target.closest('#hb-expand-all');
        if (expandBtn && section.contains(expandBtn)) {
            e.preventDefault();
            container.querySelectorAll('details.hb-acc').forEach(function (d) {
                d.open = true;
            });
            return;
        }

        var collapseBtn = e.target.closest && e.target.closest('#hb-collapse-all');
        if (collapseBtn && section.contains(collapseBtn)) {
            e.preventDefault();
            container.querySelectorAll('details.hb-acc').forEach(function (d) {
                d.open = false;
            });
            return;
        }

    }

    function initHandbookResultNavigation() {
        if (window.__hbResultNavBound) return;
        window.__hbResultNavBound = true;
        document.addEventListener('click', handleHandbookResultClick, false);
    }

    function bindWorkspaceControls(container) {
        bindCopyButtons(container);
    }

    function applyHandbookResultWorkspace(options) {
        options = options || {};
        var container = document.getElementById('handbook-content');
        if (!container) return;

        unwrapWorkspace(container);

        var jobTitle = options.jobTitle || '';
        var h1 = container.querySelector('h1');
        if (!jobTitle && h1) {
            jobTitle = (h1.textContent || '').trim();
        }
        if (!jobTitle) {
            var fromForm = document.getElementById('handbook_job_title');
            jobTitle = fromForm ? (fromForm.value || '').trim() : '';
        }
        if (h1) h1.remove();

        wrapTables(container);
        var split = splitSections(container);
        split.intro.forEach(function (n) {
            if (n.tagName === 'H1') n.remove();
        });

        if (split.sections.length) {
            var titleRow = buildTitleRow(split.sections.length);
            var controls = buildStickyControls();
            container.insertBefore(controls, container.firstChild);
            if (titleRow) container.insertBefore(titleRow, container.firstChild);

            split.sections.forEach(function (sec) {
                sec.heading.parentNode.removeChild(sec.heading);
                sec.nodes.forEach(function (n) {
                    n.parentNode.removeChild(n);
                });
            });

            wrapInAccordions(container, split.sections);
        }

        upgradeBooleanConsoles(container);
        ensureBooleanAnchor(container);
        injectPlutoTip(container);
        bindWorkspaceControls(container);
        initHandbookResultNavigation();

        if (window.setHandbookResultHeader) {
            window.setHandbookResultHeader(jobTitle);
        }

        container.dataset.workspaceBuilt = '1';
    }

    function refreshHandbookCopyButtons() {
        var container = document.getElementById('handbook-content');
        if (!container) return;
        upgradeBooleanConsoles(container);
        bindCopyButtons(container);
    }

    window.applyHandbookResultWorkspace = applyHandbookResultWorkspace;
    window.refreshHandbookCopyButtons = refreshHandbookCopyButtons;
    window.scrollToHandbookResult = scrollToHandbookResult;
    window.navigateHandbookHash = navigateHandbookHash;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHandbookResultNavigation);
    } else {
        initHandbookResultNavigation();
    }
})();
