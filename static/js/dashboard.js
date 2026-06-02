/** PeopleLogic brand palette — Chart.js and UI (4 colours + white only). */
const PLUTO_BRAND_CHART = {
    primary: 'rgba(13, 111, 174, 0.85)',
    primaryFill: 'rgba(13, 111, 174, 0.12)',
    olive: 'rgba(125, 142, 44, 0.85)',
    oliveFill: 'rgba(125, 142, 44, 0.12)',
    yellow: 'rgba(246, 194, 6, 0.85)',
    yellowFill: 'rgba(246, 194, 6, 0.2)',
    orange: 'rgba(226, 96, 20, 0.85)',
    orangeFill: 'rgba(226, 96, 20, 0.12)',
    white: '#ffffff',
    /** Score distribution buckets low → high */
    scoreBuckets: [
        'rgba(226, 96, 20, 0.75)',
        'rgba(226, 96, 20, 0.75)',
        'rgba(246, 194, 6, 0.75)',
        'rgba(246, 194, 6, 0.75)',
        'rgba(125, 142, 44, 0.75)',
    ],
    userSlice: [
        'rgba(13, 111, 174, 0.85)',
        'rgba(125, 142, 44, 0.85)',
        'rgba(246, 194, 6, 0.85)',
        'rgba(226, 96, 20, 0.85)',
    ],
};

const apiGet = (url, signal) => {
    const fn = typeof plutoFetch === 'function' ? plutoFetch : fetch;
    return fn(url, { signal, headers: { 'Cache-Control': 'no-cache' } });
};

let activityChart = null;
let teamPerformanceChart = null;
let scoreDistributionChart = null;
let userActivityChart = null;
let currentDays = 7;
let currentTeamFilter = '';
let currentUserFilter = '';
let currentDateFrom = '';
let currentDateTo = '';
let autoRefreshInterval = null;
let isAutoRefreshEnabled = false;
let isLoadingDashboard = false;
let abortController = null;
let filterDebounceTimer = null;

// Debounce function for performance
function debounce(func, wait) {
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(filterDebounceTimer);
            func(...args);
        };
        clearTimeout(filterDebounceTimer);
        filterDebounceTimer = setTimeout(later, wait);
    };
}

document.addEventListener('DOMContentLoaded', function() {
    loadTeams();
    loadAccessibleUsers();
    loadDashboard();
    
    // Date range buttons
    document.querySelectorAll('[data-days]').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('[data-days]').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentDays = parseInt(this.getAttribute('data-days'));
            // Set date range based on days
            const toDate = new Date();
            const fromDate = new Date();
            fromDate.setDate(fromDate.getDate() - currentDays);
            document.getElementById('date-from').value = fromDate.toISOString().split('T')[0];
            document.getElementById('date-to').value = toDate.toISOString().split('T')[0];
            currentDateFrom = fromDate.toISOString().split('T')[0];
            currentDateTo = toDate.toISOString().split('T')[0];
            loadDashboard();
        });
    });
    
    // Team filter change
    document.getElementById('team-filter').addEventListener('change', function() {
        currentTeamFilter = this.value;
        // Filter users dropdown based on team
        filterUsersByTeam();
    });
    
    // User filter change
    document.getElementById('user-filter').addEventListener('change', function() {
        currentUserFilter = this.value;
    });
    
    // Date filter changes (debounced for better performance)
    document.getElementById('date-from').addEventListener('change', debounce(function() {
        currentDateFrom = this.value;
    }, 300));
    
    document.getElementById('date-to').addEventListener('change', debounce(function() {
        currentDateTo = this.value;
    }, 300));
    
    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Ctrl/Cmd + R to refresh (prevent default browser refresh)
        if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
            e.preventDefault();
            loadDashboard(false);
        }
        // Escape to clear filters
        if (e.key === 'Escape') {
            clearFilters();
        }
    });
    
    // Initialize date range to last 7 days
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 7);
    document.getElementById('date-from').value = fromDate.toISOString().split('T')[0];
    document.getElementById('date-to').value = toDate.toISOString().split('T')[0];
    currentDateFrom = fromDate.toISOString().split('T')[0];
    currentDateTo = toDate.toISOString().split('T')[0];
});

async function loadTeams() {
    try {
        const response = await (typeof plutoFetch === 'function' ? plutoFetch : fetch)('/api/admin/teams');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        if (data.success && data.teams) {
            const teamSelect = document.getElementById('team-filter');
            if (teamSelect) {
                // Clear existing options except "All Teams"
                teamSelect.innerHTML = '<option value="">All Teams</option>';
                data.teams.forEach(team => {
                    const option = document.createElement('option');
                    option.value = team;
                    option.textContent = team;
                    teamSelect.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Error loading teams:', error);
        showToast('Failed to load teams', 'error');
    }
}

function filterUsersByTeam() {
    const selectedTeam = document.getElementById('team-filter').value;
    const userFilter = document.getElementById('user-filter');
    const options = userFilter.querySelectorAll('option');
    
    options.forEach(option => {
        if (option.value === '') {
            // Keep "All Users" option visible
            option.style.display = '';
        } else {
            // Show/hide based on team match
            const userTeam = option.dataset.team || '';
            if (!selectedTeam || userTeam === selectedTeam) {
                option.style.display = '';
            } else {
                option.style.display = 'none';
            }
        }
    });
    
    // Reset user filter if selected user is not in filtered team
    if (selectedTeam && userFilter.value) {
        const selectedOption = userFilter.options[userFilter.selectedIndex];
        if (selectedOption.dataset.team !== selectedTeam) {
            userFilter.value = '';
            currentUserFilter = '';
        }
    }
}

async function loadAccessibleUsers() {
    try {
        const response = await (typeof plutoFetch === 'function' ? plutoFetch : fetch)('/api/admin/accessible-users');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        if (data.success && data.users) {
            const userSelect = document.getElementById('user-filter');
            if (userSelect) {
                // Clear existing options except "All Users"
                userSelect.innerHTML = '<option value="">All Users</option>';
                data.users.forEach(user => {
                    const option = document.createElement('option');
                    option.value = user.email;
                    option.textContent = `${user.name || user.email} (${user.role})`;
                    option.dataset.team = user.team || '';
                    userSelect.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Error loading users:', error);
        showToast('Failed to load users', 'error');
    }
}

function applyFilters() {
    currentTeamFilter = document.getElementById('team-filter').value;
    currentUserFilter = document.getElementById('user-filter').value;
    currentDateFrom = document.getElementById('date-from').value;
    currentDateTo = document.getElementById('date-to').value;
    loadDashboard();
}

function clearFilters() {
    document.getElementById('team-filter').value = '';
    document.getElementById('user-filter').value = '';
    document.getElementById('date-from').value = '';
    document.getElementById('date-to').value = '';
    
    // Reset quick date buttons
    document.querySelectorAll('[data-days]').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-days') === '7') {
            btn.classList.add('active');
        }
    });
    
    // Set default to last 7 days
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 7);
    document.getElementById('date-from').value = fromDate.toISOString().split('T')[0];
    document.getElementById('date-to').value = toDate.toISOString().split('T')[0];
    
    currentTeamFilter = '';
    currentUserFilter = '';
    currentDateFrom = fromDate.toISOString().split('T')[0];
    currentDateTo = toDate.toISOString().split('T')[0];
    currentDays = 7;
    
    loadDashboard();
}

function toggleAutoRefresh() {
    const toggle = document.getElementById('auto-refresh-toggle');
    isAutoRefreshEnabled = toggle.checked;
    
    if (isAutoRefreshEnabled) {
        // Start auto-refresh every 30 seconds (refresh without showing loading skeletons)
        autoRefreshInterval = setInterval(() => {
            loadDashboard(false);
        }, 30000);
        
        // Add visual indicator
        const refreshIcon = toggle.nextElementSibling.querySelector('i');
        if (refreshIcon) {
            refreshIcon.classList.add('auto-refresh-active');
        }
        
        showToast('Auto-refresh enabled (30s interval)', 'info');
    } else {
        // Stop auto-refresh
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
        }
        
        // Remove visual indicator
        const refreshIcon = toggle.nextElementSibling.querySelector('i');
        if (refreshIcon) {
            refreshIcon.classList.remove('auto-refresh-active');
        }
        
        showToast('Auto-refresh disabled', 'info');
    }
}

function downloadCSV() {
    // Build query parameters
    const params = new URLSearchParams();
    if (currentTeamFilter) params.append('team', currentTeamFilter);
    if (currentUserFilter) params.append('user_email', currentUserFilter);
    if (currentDateFrom) params.append('date_from', currentDateFrom);
    if (currentDateTo) params.append('date_to', currentDateTo);
    
    // Trigger download
    window.location.href = `/api/analytics/export-csv?${params.toString()}`;
}

function destroyAllCharts() {
    [activityChart, teamPerformanceChart, scoreDistributionChart, userActivityChart].forEach(function (ch) {
        if (ch && typeof ch.destroy === 'function') {
            ch.destroy();
        }
    });
    activityChart = null;
    teamPerformanceChart = null;
    scoreDistributionChart = null;
    userActivityChart = null;
}

async function loadDashboard(showLoading = true) {
    // Prevent concurrent loads
    if (isLoadingDashboard && showLoading) {
        return;
    }
    destroyAllCharts();

    // Cancel previous request if still pending
    if (abortController) {
        abortController.abort();
    }
    abortController = new AbortController();
    
    isLoadingDashboard = true;
    
    try {
        if (showLoading) {
            document.getElementById('dashboard-loading').style.display = 'block';
            document.getElementById('dashboard-content').style.display = 'none';
        } else {
            // Subtle refresh indicator when auto-refreshing
            const refreshBtn = document.querySelector('button[onclick="loadDashboard(false)"]');
            if (refreshBtn) {
                const icon = refreshBtn.querySelector('i');
                if (icon) {
                    icon.classList.add('auto-refresh-active');
                    setTimeout(() => {
                        icon.classList.remove('auto-refresh-active');
                    }, 1000);
                }
            }
        }
        
        // Build query parameters
        const params = new URLSearchParams();
        if (currentTeamFilter) params.append('team', currentTeamFilter);
        if (currentUserFilter) params.append('user_email', currentUserFilter);
        if (currentDateFrom) params.append('date_from', currentDateFrom);
        if (currentDateTo) params.append('date_to', currentDateTo);
        
        // Load overview metrics with timeout and abort signal
        const overviewResponse = await (typeof plutoFetch === 'function' ? plutoFetch : fetch)(`/api/analytics/overview?${params.toString()}`, {
            signal: abortController.signal,
            headers: {
                'Cache-Control': 'no-cache'
            }
        });

        // If not logged in, API will return 401 (or may redirect to /login).
        if (overviewResponse.status === 401 || (overviewResponse.redirected && overviewResponse.url.includes('/login'))) {
            window.location.href = '/login';
            return;
        }
        
        if (!overviewResponse.ok) {
            throw new Error(`HTTP error! status: ${overviewResponse.status}`);
        }
        
        const overviewData = await overviewResponse.json();
        
        // Debug logging
        console.log('Overview API Response:', overviewData);
        
        if (!overviewData.success) {
            console.error('Overview API Error:', overviewData.message || overviewData.error);
            throw new Error(overviewData.message || 'Failed to load overview data');
        }
        
        if (overviewData.success && overviewData.metrics) {
            const metrics = overviewData.metrics;
            const setTextContent = (id, value) => {
                const el = document.getElementById(id);
                if (el) el.textContent = value || 0;
            };
            
            setTextContent('metric-total-evals', metrics.total_evaluations);
            setTextContent('metric-total-handbooks', metrics.total_handbooks);
            setTextContent('metric-total-jobs', metrics.total_jobs);
            setTextContent('metric-active-jobs', metrics.active_jobs);
            setTextContent('metric-avg-score', metrics.avg_match_score);
            setTextContent('metric-conversion-rate', metrics.conversion_rate);
            setTextContent('metric-avg-evals-job', metrics.avg_evals_per_job);
            setTextContent('metric-avg-time', metrics.avg_eval_time);
            setTextContent('metric-avg-handbook-time', metrics.avg_handbook_time || 0);
            
            // Update trend indicators
            updateTrendIndicator('metric-total-evals-trend', metrics.trends?.evaluations);
            updateTrendIndicator('metric-total-handbooks-trend', metrics.trends?.handbooks);
            updateTrendIndicator('metric-total-jobs-trend', metrics.trends?.jobs);
            updateTrendIndicator('metric-avg-score-trend', metrics.trends?.match_score);
        }
        
        const signal = abortController.signal;

        const timelineParams = new URLSearchParams();
        timelineParams.append('days', currentDays);
        if (currentUserFilter) timelineParams.append('user_email', currentUserFilter);
        if (currentDateFrom) timelineParams.append('date_from', currentDateFrom);
        if (currentDateTo) timelineParams.append('date_to', currentDateTo);

        const jobsParams = new URLSearchParams();
        jobsParams.append('limit', '10');
        if (currentUserFilter) jobsParams.append('user_email', currentUserFilter);
        if (currentDateFrom) jobsParams.append('date_from', currentDateFrom);
        if (currentDateTo) jobsParams.append('date_to', currentDateTo);

        const teamParams = new URLSearchParams();
        if (currentDateFrom) teamParams.append('date_from', currentDateFrom);
        if (currentDateTo) teamParams.append('date_to', currentDateTo);

        const scoreParams = new URLSearchParams();
        if (currentTeamFilter) scoreParams.append('team', currentTeamFilter);
        if (currentUserFilter) scoreParams.append('user_email', currentUserFilter);
        if (currentDateFrom) scoreParams.append('date_from', currentDateFrom);
        if (currentDateTo) scoreParams.append('date_to', currentDateTo);

        const userParams = new URLSearchParams();
        if (currentTeamFilter) userParams.append('team', currentTeamFilter);
        if (currentDateFrom) userParams.append('date_from', currentDateFrom);
        if (currentDateTo) userParams.append('date_to', currentDateTo);

        const activityParams = new URLSearchParams();
        activityParams.append('limit', '20');
        if (currentTeamFilter) activityParams.append('team', currentTeamFilter);
        if (currentUserFilter) activityParams.append('user_email', currentUserFilter);
        if (currentDateFrom) activityParams.append('date_from', currentDateFrom);
        if (currentDateTo) activityParams.append('date_to', currentDateTo);

        try {
            const [
                timelineResponse,
                jobsResponse,
                teamResponse,
                scoreResponse,
                userResponse,
                activityResponse,
            ] = await Promise.all([
                apiGet(`/api/analytics/timeline?${timelineParams}`, signal),
                apiGet(`/api/analytics/top-jobs?${jobsParams}`, signal),
                apiGet(`/api/analytics/team-performance?${teamParams}`, signal),
                apiGet(`/api/analytics/match-score-distribution?${scoreParams}`, signal),
                apiGet(`/api/analytics/user-activity?${userParams}`, signal),
                apiGet(`/api/analytics/recent-activity?${activityParams}`, signal),
            ]);

            if (timelineResponse.ok) {
                const timelineData = await timelineResponse.json();
                if (timelineData.success && timelineData.timeline) {
                    renderActivityChart(timelineData.timeline);
                }
            }
            if (jobsResponse.ok) {
                const jobsData = await jobsResponse.json();
                if (jobsData.success && jobsData.jobs) {
                    renderTopJobs(jobsData.jobs);
                }
            }
            if (teamResponse.ok) {
                const teamData = await teamResponse.json();
                if (teamData.success && teamData.teams) {
                    renderTeamPerformanceChart(teamData.teams);
                }
            }
            if (scoreResponse.ok) {
                const scoreData = await scoreResponse.json();
                if (scoreData.success && scoreData.distribution) {
                    renderScoreDistributionChart(scoreData.distribution);
                }
            }
            if (userResponse.ok) {
                const userData = await userResponse.json();
                if (userData.success && userData.users) {
                    renderUserActivityChart(userData.users);
                    renderTopPerformers(userData.users);
                }
            }
            if (activityResponse.ok) {
                const activityData = await activityResponse.json();
                if (activityData.success) {
                    renderRecentActivityFeed(activityData.activities || []);
                    if (overviewData.metrics) {
                        renderQuickStatsSummary(overviewData.metrics, activityData.activities || []);
                        renderPerformanceTrends(overviewData.metrics);
                    }
                }
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Error loading dashboard charts:', err);
            }
        }
        
        if (showLoading) {
            document.getElementById('dashboard-loading').style.display = 'none';
            document.getElementById('dashboard-content').style.display = 'block';
        }
        
    } catch (error) {
        // Don't show error if request was aborted
        if (error.name === 'AbortError') {
            return;
        }
        
        console.error('Error loading dashboard:', error);
        if (showLoading) {
            document.getElementById('dashboard-loading').innerHTML = `
                <div class="alert alert-danger">
                    <strong>Error:</strong> Failed to load dashboard data. ${error.message || 'Please try again.'}
                    <div class="mt-2">
                        <button class="btn btn-sm btn-primary" onclick="loadDashboard()">Retry</button>
                        <button class="btn btn-sm btn-outline-secondary" onclick="clearFilters()">Reset Filters</button>
                    </div>
                </div>
            `;
        } else {
            // Show toast notification for auto-refresh errors
            showToast('Failed to refresh dashboard', 'error');
        }
    } finally {
        isLoadingDashboard = false;
        abortController = null;
    }
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    // Simple toast notification
    const toast = document.createElement('div');
    toast.className = `alert alert-${type === 'error' ? 'danger' : 'info'} alert-dismissible fade show position-fixed`;
    toast.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    toast.innerHTML = `
        ${escapeHtml(message)}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function renderActivityChart(timeline) {
    const canvas = document.getElementById('activityChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    if (!timeline || timeline.length === 0) {
        canvas.parentElement.innerHTML = '<p class="text-muted text-center py-4">No timeline data available</p>';
        return;
    }
    
    const labels = timeline.map(t => t.date);
    const evaluations = timeline.map(t => t.evaluations || 0);
    const handbooks = timeline.map(t => t.handbooks || 0);
    
    if (activityChart) {
        activityChart.destroy();
    }
    
    activityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Evaluations',
                    data: evaluations,
                    borderColor: PLUTO_BRAND_CHART.primary,
                    backgroundColor: PLUTO_BRAND_CHART.primaryFill,
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Handbooks',
                    data: handbooks,
                    borderColor: PLUTO_BRAND_CHART.olive,
                    backgroundColor: PLUTO_BRAND_CHART.oliveFill,
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            if (!context || !context[0] || !context[0].label) return '';
                            try {
                                const date = new Date(context[0].label);
                                if (isNaN(date.getTime())) return context[0].label;
                                return date.toLocaleDateString();
                            } catch (e) {
                                return context[0].label || '';
                            }
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function renderTopJobs(jobs) {
    const tbody = document.getElementById('top-jobs-body');
    if (!tbody) return;
    
    if (!jobs || !Array.isArray(jobs) || jobs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No data available</td></tr>';
        return;
    }
    
    tbody.innerHTML = jobs.map((job, index) => {
        const jobId = escapeHtml(job.job_id || 'N/A');
        const jobTitle = escapeHtml(job.job_title || 'Untitled');
        const evalCount = job.eval_count || 0;
        const avgScore = job.avg_score || 0;
        const lastActive = job.last_active ? new Date(job.last_active).toLocaleString() : 'N/A';
        
        return `
            <tr>
                <td><strong>${index + 1}</strong></td>
                <td><span class="badge bg-primary">${jobId}</span></td>
                <td>${jobTitle}</td>
                <td><span class="badge bg-info">${evalCount}</span></td>
                <td><strong>${avgScore}%</strong></td>
                <td><small class="text-muted">${lastActive}</small></td>
            </tr>
        `;
    }).join('');
}

function updateTrendIndicator(elementId, trend) {
    const element = document.getElementById(elementId);
    if (!element || !trend || trend.change === null || trend.change === undefined) {
        return;
    }
    
    const isPositive = trend.change > 0;
    const isNegative = trend.change < 0;
    const iconClass = isPositive ? 'bi-arrow-up' : (isNegative ? 'bi-arrow-down' : 'bi-dash');
    const trendClass = isPositive ? 'trend-up' : (isNegative ? 'trend-down' : 'trend-neutral');
    const sign = isPositive ? '+' : '';
    
    element.innerHTML = `
        <i class="bi ${iconClass}"></i> 
        <span class="${trendClass}">${sign}${trend.change} (${sign}${trend.percent}%)</span>
    `;
}

function renderTeamPerformanceChart(teams) {
    const ctx = document.getElementById('teamPerformanceChart');
    if (!ctx) return;
    
    if (teamPerformanceChart) {
        teamPerformanceChart.destroy();
    }
    
    if (!teams || teams.length === 0) {
        ctx.parentElement.innerHTML = '<p class="text-muted text-center py-4">No team data available</p>';
        return;
    }
    
    const chartCtx = ctx.getContext('2d');
    const labels = teams.map(t => t.team || 'Unknown');
    const evalData = teams.map(t => t.evaluations || 0);
    const handbookData = teams.map(t => t.handbooks || 0);
    
    teamPerformanceChart = new Chart(chartCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Evaluations',
                    data: evalData,
                    backgroundColor: PLUTO_BRAND_CHART.primary,
                    borderColor: PLUTO_BRAND_CHART.primary,
                    borderWidth: 1
                },
                {
                    label: 'Handbooks',
                    data: handbookData,
                    backgroundColor: PLUTO_BRAND_CHART.olive,
                    borderColor: PLUTO_BRAND_CHART.olive,
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            if (!teams || !teams[context.dataIndex]) return '';
                            const team = teams[context.dataIndex];
                            const avgScore = team.avg_score || 0;
                            return `Avg Score: ${avgScore}%`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function renderScoreDistributionChart(distribution) {
    const ctx = document.getElementById('scoreDistributionChart');
    if (!ctx) return;
    
    if (scoreDistributionChart) {
        scoreDistributionChart.destroy();
    }
    
    if (!distribution || distribution.length === 0) {
        ctx.parentElement.innerHTML = '<p class="text-muted text-center py-4">No score data available</p>';
        return;
    }
    
    const chartCtx = ctx.getContext('2d');
    const labels = distribution.map(d => (d.range || 'Unknown') + '%');
    const data = distribution.map(d => d.count || 0);
    const colors = distribution.map(function (_, i) {
        return PLUTO_BRAND_CHART.scoreBuckets[i % PLUTO_BRAND_CHART.scoreBuckets.length];
    });
    
    scoreDistributionChart = new Chart(chartCtx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: PLUTO_BRAND_CHART.white
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'right',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (!data || !Array.isArray(data)) return '';
                            const total = data.reduce((a, b) => (a || 0) + (b || 0), 0);
                            const parsed = context.parsed || 0;
                            const percentage = total > 0 ? ((parsed / total) * 100).toFixed(1) : 0;
                            const label = context.label || 'Unknown';
                            return `${label}: ${parsed} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function renderUserActivityChart(users) {
    const ctx = document.getElementById('userActivityChart');
    if (!ctx) return;
    
    if (userActivityChart) {
        userActivityChart.destroy();
    }
    
    if (!users || users.length === 0) {
        ctx.parentElement.innerHTML = '<p class="text-muted text-center py-4">No user activity data available</p>';
        return;
    }
    
    // Show top 10 users
    const topUsers = users.slice(0, 10);
    const chartCtx = ctx.getContext('2d');
    const labels = topUsers.map(u => {
        const name = (u.name || u.email || 'Unknown');
        return name.length > 20 ? name.substring(0, 20) + '...' : name;
    });
    const totalData = topUsers.map(u => u.total || 0);
    
    // Generate colors for each user
    const colors = [];
    for (var ci = 0; ci < topUsers.length; ci++) {
        colors.push(PLUTO_BRAND_CHART.userSlice[ci % PLUTO_BRAND_CHART.userSlice.length]);
    }
    
    userActivityChart = new Chart(chartCtx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: totalData,
                backgroundColor: colors.slice(0, topUsers.length),
                borderColor: PLUTO_BRAND_CHART.white,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'right',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (!topUsers || !topUsers[context.dataIndex]) return '';
                            const user = topUsers[context.dataIndex];
                            const total = totalData.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
                            const userName = user.name || user.email || 'Unknown';
                            const userTotal = user.total || 0;
                            const evaluations = user.evaluations || 0;
                            const handbooks = user.handbooks || 0;
                            return `${userName}: ${userTotal} total (${evaluations} evals, ${handbooks} handbooks) - ${percentage}%`;
                        }
                    }
                }
            }
        }
    });
}

function renderTopPerformers(users) {
    const tbody = document.getElementById('top-performers-body');
    if (!tbody) return;
    
    if (!users || !Array.isArray(users) || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No data available</td></tr>';
        return;
    }
    
    // Show top 10 performers
    const topPerformers = users.slice(0, 10);
    
    tbody.innerHTML = topPerformers.map((user, index) => {
        const userName = escapeHtml(user.name || user.email || 'Unknown');
        const evaluations = user.evaluations || 0;
        const handbooks = user.handbooks || 0;
        const total = user.total || 0;
        
        return `
            <tr>
                <td><strong>${index + 1}</strong></td>
                <td>${userName}</td>
                <td><span class="badge bg-info">${evaluations}</span></td>
                <td><span class="badge bg-success">${handbooks}</span></td>
                <td><strong>${total}</strong></td>
            </tr>
        `;
    }).join('');
}

function renderRecentActivityFeed(activities) {
    const feed = document.getElementById('recent-activity-feed');
    if (!feed) return;
    
    if (!activities || activities.length === 0) {
        feed.innerHTML = '<p class="text-muted text-center py-4">No recent activity</p>';
        return;
    }
    
    feed.innerHTML = activities.map(activity => {
        if (!activity) return '';
        
        const timeAgo = getTimeAgo(activity.timestamp);
        const icon = activity.type === 'evaluation' ? 'bi-file-earmark-check' : 'bi-book';
        const badgeColor = activity.type === 'evaluation' ? 'bg-primary' : 'bg-success';
        const typeLabel = activity.type === 'evaluation' ? 'Evaluation' : 'Handbook';
        const userName = escapeHtml(activity.user_name || activity.user_email || 'Unknown');
        const jobTitle = escapeHtml(activity.job_title || 'Untitled Job');
        const jobId = escapeHtml(activity.job_id || '');
        const filename = escapeHtml(activity.filename || '');
        
        let matchBadge = '';
        if (activity.match_percentage !== null && activity.match_percentage !== undefined) {
            const matchColor = activity.match_percentage >= 70 ? 'success' : 
                              activity.match_percentage >= 50 ? 'warning' : 'danger';
            matchBadge = `<span class="badge bg-${matchColor} ms-2">${activity.match_percentage}%</span>`;
        }
        
        return `
            <div class="d-flex align-items-start mb-3 pb-3 border-bottom">
                <div class="flex-shrink-0">
                    <span class="badge ${badgeColor} rounded-circle p-2">
                        <i class="bi ${icon}"></i>
                    </span>
                </div>
                <div class="flex-grow-1 ms-3">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <strong>${userName}</strong> ${activity.type === 'evaluation' ? 'evaluated' : 'generated'} 
                            <span class="badge bg-light text-dark">${typeLabel}</span>
                            ${matchBadge}
                            <br>
                            <small class="text-muted">
                                ${jobTitle}
                                ${jobId ? `<span class="badge bg-secondary">${jobId}</span>` : ''}
                                ${filename ? `<br><i class="bi bi-file"></i> ${filename}` : ''}
                            </small>
                        </div>
                        <small class="text-muted">${timeAgo}</small>
                    </div>
                </div>
            </div>
        `;
    }).filter(html => html).join('');
}

function renderQuickStatsSummary(metrics, activities) {
    const summary = document.getElementById('quick-stats-summary');
    if (!summary) return;
    
    if (!metrics) {
        summary.innerHTML = '<p class="text-muted text-center">No metrics data available</p>';
        return;
    }
    
    // Calculate quick stats (handle empty activities array)
    const activitiesArray = Array.isArray(activities) ? activities : [];
    const todayActivities = activitiesArray.filter(a => {
        if (!a || !a.timestamp) return false;
        try {
            const activityDate = new Date(a.timestamp).toDateString();
            return activityDate === new Date().toDateString();
        } catch (e) {
            return false;
        }
    }).length;
    
    const thisWeekActivities = activitiesArray.filter(a => {
        if (!a || !a.timestamp) return false;
        try {
            const activityDate = new Date(a.timestamp);
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return activityDate >= weekAgo;
        } catch (e) {
            return false;
        }
    }).length;
    
    const avgScore = metrics.avg_match_score || 0;
    const scoreStatus = avgScore >= 70 ? 'success' : avgScore >= 50 ? 'warning' : 'danger';
    
    summary.innerHTML = `
        <div class="mb-3">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="text-muted">Today's Activity</span>
                <strong class="text-primary">${todayActivities}</strong>
            </div>
            <div class="progress" style="height: 8px;">
                <div class="progress-bar bg-primary" role="progressbar" 
                     style="width: ${Math.min((todayActivities / 20) * 100, 100)}%"></div>
            </div>
        </div>
        
        <div class="mb-3">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="text-muted">This Week</span>
                <strong class="text-success">${thisWeekActivities}</strong>
            </div>
            <div class="progress" style="height: 8px;">
                <div class="progress-bar bg-success" role="progressbar" 
                     style="width: ${Math.min((thisWeekActivities / 100) * 100, 100)}%"></div>
            </div>
        </div>
        
        <div class="mb-3">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="text-muted">Avg Match Score</span>
                <strong class="text-${scoreStatus}">${avgScore}%</strong>
            </div>
            <div class="progress" style="height: 8px;">
                <div class="progress-bar bg-${scoreStatus}" role="progressbar" 
                     style="width: ${avgScore}%"></div>
            </div>
        </div>
        
        <div class="mt-4 pt-3 border-top">
            <div class="row text-center">
                <div class="col-6">
                    <div class="mb-2">
                        <i class="bi bi-file-earmark-text fs-4 text-primary"></i>
                    </div>
                    <div class="h5 mb-0">${metrics.total_evaluations || 0}</div>
                    <small class="text-muted">Evaluations</small>
                </div>
                <div class="col-6">
                    <div class="mb-2">
                        <i class="bi bi-book fs-4 text-success"></i>
                    </div>
                    <div class="h5 mb-0">${metrics.total_handbooks || 0}</div>
                    <small class="text-muted">Handbooks</small>
                </div>
            </div>
        </div>
    `;
}

function renderPerformanceTrends(metrics) {
    const trendsElement = document.getElementById('performance-trends');
    if (!trendsElement) return;
    
    if (!metrics) {
        trendsElement.innerHTML = '<div class="col-12"><p class="text-muted text-center">No metrics data available</p></div>';
        return;
    }
    
    // If no trends data, show basic metrics without trends
    if (!metrics.trends) {
        trendsElement.innerHTML = `
            <div class="col-md-3">
                <div class="text-center p-3 border rounded hover-lift">
                    <i class="bi bi-file-earmark-text fs-3 text-primary mb-2"></i>
                    <div class="h4 mb-1">${metrics.total_evaluations || 0}</div>
                    <small class="text-muted d-block">Total Evaluations</small>
                </div>
            </div>
            <div class="col-md-3">
                <div class="text-center p-3 border rounded hover-lift">
                    <i class="bi bi-book fs-3 text-success mb-2"></i>
                    <div class="h4 mb-1">${metrics.total_handbooks || 0}</div>
                    <small class="text-muted d-block">Total Handbooks</small>
                </div>
            </div>
            <div class="col-md-3">
                <div class="text-center p-3 border rounded hover-lift">
                    <i class="bi bi-briefcase fs-3 text-info mb-2"></i>
                    <div class="h4 mb-1">${metrics.total_jobs || 0}</div>
                    <small class="text-muted d-block">Total Jobs</small>
                </div>
            </div>
            <div class="col-md-3">
                <div class="text-center p-3 border rounded hover-lift">
                    <i class="bi bi-star fs-3 text-warning mb-2"></i>
                    <div class="h4 mb-1">${metrics.avg_match_score || 0}%</div>
                    <small class="text-muted d-block">Avg Match Score</small>
                </div>
            </div>
        `;
        return;
    }
    
    const trendsData = metrics.trends || {};
    const trendData = [
        {
            label: 'Evaluations Trend',
            value: metrics.total_evaluations || 0,
            trend: trendsData.evaluations,
            icon: 'bi-file-earmark-text',
            color: 'primary'
        },
        {
            label: 'Handbooks Trend',
            value: metrics.total_handbooks || 0,
            trend: trendsData.handbooks,
            icon: 'bi-book',
            color: 'success'
        },
        {
            label: 'Jobs Trend',
            value: metrics.total_jobs || 0,
            trend: trendsData.jobs,
            icon: 'bi-briefcase',
            color: 'info'
        },
        {
            label: 'Match Score Trend',
            value: `${metrics.avg_match_score || 0}%`,
            trend: trendsData.match_score,
            icon: 'bi-star',
            color: 'warning'
        }
    ];
    
    trendsElement.innerHTML = trendData.map(item => {
        const trend = item.trend;
        let trendHTML = '';
        if (trend && trend.change !== null && trend.change !== undefined) {
            const isPositive = trend.change > 0;
            const icon = isPositive ? 'bi-arrow-up' : (trend.change < 0 ? 'bi-arrow-down' : 'bi-dash');
            const color = isPositive ? 'success' : (trend.change < 0 ? 'danger' : 'secondary');
            const sign = isPositive ? '+' : '';
            trendHTML = `
                <div class="mt-2">
                    <small class="text-${color}">
                        <i class="bi ${icon}"></i> ${sign}${trend.change} (${sign}${trend.percent}%)
                    </small>
                </div>
            `;
        } else {
            trendHTML = '<div class="mt-2"><small class="text-muted">No comparison data</small></div>';
        }
        
        return `
            <div class="col-md-3">
                <div class="text-center p-3 border rounded hover-lift">
                    <i class="bi ${item.icon} fs-3 text-${item.color} mb-2"></i>
                    <div class="h4 mb-1">${item.value}</div>
                    <small class="text-muted d-block">${item.label}</small>
                    ${trendHTML}
                </div>
            </div>
        `;
    }).join('');
}

function getTimeAgo(timestamp) {
    if (!timestamp) return 'Unknown';
    
    try {
        const now = new Date();
        const time = new Date(timestamp);
        
        // Check if date is valid
        if (isNaN(time.getTime())) {
            return 'Invalid date';
        }
        
        const diffMs = now - time;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return time.toLocaleDateString();
    } catch (e) {
        console.error('Error calculating time ago:', e);
        return 'Unknown';
    }
}
