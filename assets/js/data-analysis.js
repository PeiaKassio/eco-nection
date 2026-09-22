(function initEcoDataAnalysis(root) {
    const LOW_SUPPORT_DENOMINATOR = 5;
    const TEMPORAL_SHIFT_MIN_RECORDS = 3;
    const TEMPORAL_SHIFT_MIN_YEARS = 2;
    const PER_POPULATION_UNIT = 1000000;
    const SMOOTHING_WINDOW_RADIUS = 1;
    const MAX_EVIDENCE_ITEMS = 20;

    const SCIENCE_NEUTRAL_COLOR = '#14b8a6';
    const ART_SERIES_COLOR = '#f59e0b';
    const SCIENCE_SERIES_COLOR = '#2dd4bf';

    const state = {
        artRecords: [],
        scienceRecords: [],
        topicClusters: {},
        continentMapping: {},
        countryPopulation: {},
        clusterColors: {},
        scienceAvailable: false,
        mode: 'compare',
        metric: 'share',
        geographyMode: 'countries',
        relationshipMode: 'art',
        evidenceMode: 'art',
        timeSeriesMode: 'raw',
        filters: {
            continent: '',
            country: '',
            topics: [],
            fromYear: null,
            toYear: null
        },
        charts: {},
        network: null
    };

    function escapeHtml(value) {
        return (value ?? '')
            .toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function uniq(values) {
        return Array.from(new Set((values || []).filter(Boolean)));
    }

    function toNumber(value) {
        if (value == null || value.toString().trim() === '') return null;
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
    }

    function normalizeYear(value, ecoData = root.EcoData) {
        if (ecoData?.parseYear) return ecoData.parseYear(value);
        const year = parseInt(value, 10);
        return Number.isNaN(year) ? null : year;
    }

    function normalizeId(value, fallback) {
        return value == null || value === '' ? fallback : value.toString();
    }

    function getRecordClusterSet(record) {
        return new Set(record.clusters || []);
    }

    function formatPercent(value) {
        if (value == null || Number.isNaN(value)) return 'N/A';
        return `${value.toFixed(value >= 10 ? 1 : 2)}%`;
    }

    function formatMetricValue(value, metric = state.metric) {
        if (value == null || Number.isNaN(value)) return 'N/A';
        if (metric === 'share') return formatPercent(value);
        if (metric === 'perPopulation') return `${value.toFixed(value >= 10 ? 1 : 2)} / 1M`;
        return value.toLocaleString();
    }

    function formatDifference(value, metric = state.metric) {
        if (value == null || Number.isNaN(value)) return 'N/A';
        const sign = value > 0 ? '+' : '';
        if (metric === 'share') return `${sign}${value.toFixed(1)} pp`;
        if (metric === 'perPopulation') return `${sign}${value.toFixed(value >= 10 || value <= -10 ? 1 : 2)} / 1M`;
        return `${sign}${value.toLocaleString()}`;
    }

    function formatDifferenceMagnitude(value, metric = state.metric) {
        const magnitude = Math.abs(value);
        if (metric === 'share') return `${magnitude.toFixed(1)} percentage points`;
        if (metric === 'perPopulation') return `${magnitude.toFixed(magnitude >= 10 ? 1 : 2)} records per 1M inhabitants`;
        return `${magnitude.toLocaleString()} records`;
    }

    function normalizeArtRecords(artworkData, dependencies) {
        const ecoData = dependencies.ecoData;
        return (artworkData?.features || []).map((feature, index) => {
            const props = feature.properties || {};
            const country = ecoData.getCountryFromLocation(props.location, dependencies.continentMapping, dependencies.countryPopulation);
            const continent = ecoData.getContinentForCountry(country, dependencies.continentMapping);
            const clusters = uniq(ecoData.getArtworkClusters(feature, dependencies.topicClusters));
            const topics = uniq(props.tags?.topic || []);
            const fallbackId = [
                'art',
                index,
                props.title || 'untitled',
                props.artist || '',
                props.location || '',
                props.year || ''
            ].join('::');

            return {
                dataset: 'art',
                id: normalizeId(props.id, fallbackId),
                title: props.title || 'Untitled artwork',
                creator: props.artist || '',
                year: normalizeYear(props.year, ecoData),
                country,
                continent,
                location: props.location || country || 'Unknown',
                topics,
                clusters,
                url: props.url || '',
                source: props.type || '',
                raw: feature
            };
        });
    }

    function normalizeScienceRecords(scienceMapData, dependencies) {
        const ecoData = dependencies.ecoData;
        const records = [
            ...(scienceMapData?.records || []),
            ...(scienceMapData?.nonPlaceableRecords || []),
            ...(scienceMapData?.globalRecords || [])
        ];

        return records.map((record, index) => {
            const country = record.country || '';
            return {
                dataset: 'science',
                id: normalizeId(record.publicationId, `science-${index}`),
                publicationId: record.publicationId,
                studyAreaId: record.studyAreaId,
                title: record.title || record.publicationTitle || `Publication ${record.publicationId ?? index + 1}`,
                creator: record.journal || record.publisher || record.sourceName || '',
                year: normalizeYear(record.year, ecoData),
                country: country || 'Other',
                continent: record.continent || ecoData.getContinentForCountry(country, dependencies.continentMapping),
                location: [record.city, record.region, country].filter(Boolean).join(', ') || record.geographicScope || 'Study area unavailable',
                topics: uniq(record.topics || []),
                clusters: uniq(record.topicClusters || []),
                url: record.url || record.doiUrl || record.doi || '',
                doi: record.doi || '',
                source: record.sourceName || record.journal || record.publisher || 'Science export',
                geographicScope: record.geographicScope || '',
                raw: record
            };
        });
    }

    function recordPassesBase(record, filters, overrides = {}) {
        const active = { ...filters, ...overrides };
        if (active.continent && record.continent !== active.continent) return false;
        if (active.country && record.country !== active.country) return false;
        if (active.fromYear != null && record.year != null && record.year < active.fromYear) return false;
        if (active.toYear != null && record.year != null && record.year > active.toYear) return false;
        return true;
    }

    function recordPassesTopics(record, topics) {
        if (!topics || topics.length === 0) return true;
        const clusterSet = getRecordClusterSet(record);
        return topics.some(topic => clusterSet.has(topic));
    }

    function uniqueRecords(records) {
        const byId = new Map();
        records.forEach(record => {
            if (!byId.has(record.id)) byId.set(record.id, record);
        });
        return Array.from(byId.values());
    }

    function countUnique(records) {
        return uniqueRecords(records).length;
    }

    function getBaseRecords(records, filters, overrides = {}) {
        return uniqueRecords(records.filter(record => recordPassesBase(record, filters, overrides)));
    }

    function getTopicRecords(records, filters, topic, overrides = {}) {
        return uniqueRecords(records.filter(record => {
            if (!recordPassesBase(record, filters, overrides)) return false;
            if (!topic) return recordPassesTopics(record, filters.topics);
            return getRecordClusterSet(record).has(topic);
        }));
    }

    function getPopulationForScope(records, level, label, countryPopulation) {
        if (level === 'country') return countryPopulation[label] || null;
        const countries = new Set(records.map(record => record.country).filter(country => country && country !== 'Other'));
        const population = Array.from(countries).reduce((sum, country) => sum + (countryPopulation[country] || 0), 0);
        return population || null;
    }

    function metricFromCount(count, denominator, population, metric) {
        if (metric === 'share') {
            return denominator > 0 ? (count / denominator) * 100 : null;
        }
        if (metric === 'perPopulation') {
            return population ? (count / population) * PER_POPULATION_UNIT : null;
        }
        return count;
    }

    function calculateTopicShare(records, filters, topic, metric = 'share', options = {}) {
        const baseRecords = getBaseRecords(records, filters, options.baseOverrides);
        const matchingRecords = topic
            ? getTopicRecords(records, filters, topic, options.baseOverrides)
            : uniqueRecords(baseRecords.filter(record => recordPassesTopics(record, filters.topics)));
        const population = options.population ?? getPopulationForScope(baseRecords, options.level || 'selection', options.label || '', options.countryPopulation || {});

        return {
            count: matchingRecords.length,
            denominator: baseRecords.length,
            population,
            value: metricFromCount(matchingRecords.length, baseRecords.length, population, metric),
            lowSupport: baseRecords.length > 0 && baseRecords.length < LOW_SUPPORT_DENOMINATOR
        };
    }

    function calculateYearlyTopicShares(records, filters, topic, metric = 'share', countryPopulation = {}) {
        if (!topic) return [];
        const baseRecords = records.filter(record => recordPassesBase(record, filters) && record.year != null);
        const years = Array.from(new Set(baseRecords.map(record => record.year))).sort((a, b) => a - b);

        return years.map(year => {
            const yearlyBase = uniqueRecords(baseRecords.filter(record => record.year === year));
            const yearlyTopic = uniqueRecords(yearlyBase.filter(record => getRecordClusterSet(record).has(topic)));
            const countries = new Set(yearlyBase.map(record => record.country).filter(country => country && country !== 'Other'));
            const population = Array.from(countries).reduce((sum, country) => sum + (countryPopulation[country] || 0), 0) || null;
            return {
                year,
                count: yearlyTopic.length,
                denominator: yearlyBase.length,
                population,
                value: metricFromCount(yearlyTopic.length, yearlyBase.length, population, metric),
                share: metricFromCount(yearlyTopic.length, yearlyBase.length, population, 'share'),
                lowSupport: yearlyBase.length > 0 && yearlyBase.length < LOW_SUPPORT_DENOMINATOR
            };
        });
    }

    function smoothYearlySeries(series, key = 'value') {
        return series.map(point => {
            const nearby = series.filter(candidate => Math.abs(candidate.year - point.year) <= SMOOTHING_WINDOW_RADIUS && candidate[key] != null);
            const value = nearby.length
                ? nearby.reduce((sum, candidate) => sum + candidate[key], 0) / nearby.length
                : point[key];
            return { ...point, [`${key}Raw`]: point[key], [key]: value };
        });
    }

    function calculateAttentionCenter(yearlyShares) {
        const weighted = yearlyShares
            .filter(point => point.share != null && point.share > 0 && point.denominator > 0)
            .sort((a, b) => a.year - b.year);
        const totalWeight = weighted.reduce((sum, point) => sum + point.share, 0);
        if (totalWeight <= 0) return null;

        let cumulative = 0;
        for (const point of weighted) {
            cumulative += point.share;
            if (cumulative >= totalWeight / 2) return point.year;
        }
        return weighted.at(-1)?.year ?? null;
    }

    function getTemporalSupport(yearlyShares) {
        const usable = yearlyShares.filter(point => point.denominator > 0 && point.count > 0);
        return {
            records: usable.reduce((sum, point) => sum + point.count, 0),
            years: usable.length
        };
    }

    function calculateTemporalShift(artYearly, scienceYearly) {
        const artSupport = getTemporalSupport(artYearly);
        const scienceSupport = getTemporalSupport(scienceYearly);
        const hasSupport =
            artSupport.records >= TEMPORAL_SHIFT_MIN_RECORDS &&
            scienceSupport.records >= TEMPORAL_SHIFT_MIN_RECORDS &&
            artSupport.years >= TEMPORAL_SHIFT_MIN_YEARS &&
            scienceSupport.years >= TEMPORAL_SHIFT_MIN_YEARS;

        if (!hasSupport) {
            return {
                artCenter: null,
                scienceCenter: null,
                shift: null,
                supported: false,
                artSupport,
                scienceSupport
            };
        }

        const artCenter = calculateAttentionCenter(artYearly);
        const scienceCenter = calculateAttentionCenter(scienceYearly);
        return {
            artCenter,
            scienceCenter,
            shift: artCenter != null && scienceCenter != null ? artCenter - scienceCenter : null,
            supported: artCenter != null && scienceCenter != null,
            artSupport,
            scienceSupport
        };
    }

    function calculateTopicMetrics(artRecords, scienceRecords, filters, topics, metric, countryPopulation) {
        return topics.map(topic => {
            const art = calculateTopicShare(artRecords, filters, topic, metric, { countryPopulation });
            const science = calculateTopicShare(scienceRecords, filters, topic, metric, { countryPopulation });
            return {
                topic,
                art,
                science,
                difference: art.value != null && science.value != null ? art.value - science.value : null
            };
        });
    }

    function calculateGeographicDifferences(artRecords, scienceRecords, filters, topic, metric, level, countryPopulation) {
        if (!topic) return [];
        const labelKey = level === 'continents' ? 'continent' : 'country';
        const labels = new Set();
        [...artRecords, ...scienceRecords].forEach(record => {
            if (!recordPassesBase(record, filters, { country: level === 'countries' ? '' : filters.country })) return;
            if (level === 'countries' && filters.continent && record.continent !== filters.continent) return;
            if (record[labelKey]) labels.add(record[labelKey]);
        });

        return Array.from(labels)
            .filter(label => label && label !== 'Other')
            .map(label => {
                const overrides = labelKey === 'country' ? { country: label } : { continent: label, country: '' };
                const artBase = getBaseRecords(artRecords, filters, overrides);
                const scienceBase = getBaseRecords(scienceRecords, filters, overrides);
                const artPopulation = getPopulationForScope(artBase, labelKey === 'country' ? 'country' : 'continent', label, countryPopulation);
                const sciencePopulation = getPopulationForScope(scienceBase, labelKey === 'country' ? 'country' : 'continent', label, countryPopulation);
                const art = calculateTopicShare(artRecords, filters, topic, metric, {
                    baseOverrides: overrides,
                    population: artPopulation,
                    level: labelKey === 'country' ? 'country' : 'continent',
                    label,
                    countryPopulation
                });
                const science = calculateTopicShare(scienceRecords, filters, topic, metric, {
                    baseOverrides: overrides,
                    population: sciencePopulation,
                    level: labelKey === 'country' ? 'country' : 'continent',
                    label,
                    countryPopulation
                });
                return {
                    label,
                    art,
                    science,
                    difference: art.value != null && science.value != null ? art.value - science.value : null
                };
            })
            .filter(item => item.art.denominator > 0 || item.science.denominator > 0)
            .sort((a, b) => Math.abs(b.difference || 0) - Math.abs(a.difference || 0) || a.label.localeCompare(b.label))
            .slice(0, 14);
    }

    function buildAnalysisModel() {
        const topics = Object.keys(state.topicClusters).sort();
        const focusedTopic = state.filters.topics.length === 1 ? state.filters.topics[0] : null;
        const visibleTopics = state.filters.topics.length > 0 ? state.filters.topics : topics;
        const artBase = getBaseRecords(state.artRecords, state.filters);
        const scienceBase = getBaseRecords(state.scienceRecords, state.filters);
        const artFiltered = uniqueRecords(artBase.filter(record => recordPassesTopics(record, state.filters.topics)));
        const scienceFiltered = uniqueRecords(scienceBase.filter(record => recordPassesTopics(record, state.filters.topics)));
        const topicMetrics = calculateTopicMetrics(
            state.artRecords,
            state.scienceRecords,
            state.filters,
            visibleTopics,
            state.metric,
            state.countryPopulation
        );
        const yearly = focusedTopic ? {
            art: calculateYearlyTopicShares(state.artRecords, state.filters, focusedTopic, state.metric, state.countryPopulation),
            science: calculateYearlyTopicShares(state.scienceRecords, state.filters, focusedTopic, state.metric, state.countryPopulation)
        } : { art: [], science: [] };

        const temporal = (state.filters.topics.length > 0 ? state.filters.topics : topics).map(topic => {
            const artYearly = calculateYearlyTopicShares(state.artRecords, state.filters, topic, 'share', state.countryPopulation);
            const scienceYearly = calculateYearlyTopicShares(state.scienceRecords, state.filters, topic, 'share', state.countryPopulation);
            return {
                topic,
                ...calculateTemporalShift(artYearly, scienceYearly)
            };
        }).sort((a, b) => Math.abs(b.shift || 0) - Math.abs(a.shift || 0) || a.topic.localeCompare(b.topic));

        const geographic = calculateGeographicDifferences(
            state.artRecords,
            state.scienceRecords,
            state.filters,
            focusedTopic,
            state.metric,
            state.geographyMode,
            state.countryPopulation
        );

        return {
            topics,
            visibleTopics,
            focusedTopic,
            artBase,
            scienceBase,
            artFiltered,
            scienceFiltered,
            topicMetrics,
            yearly,
            temporal,
            geographic
        };
    }

    function getActiveDatasets() {
        if (state.mode === 'art') return ['art'];
        if (state.mode === 'science') return ['science'];
        return ['art', 'science'];
    }

    function isCompareModeReady() {
        return state.mode !== 'compare' || state.scienceAvailable;
    }

    function setEmpty(containerId, message) {
        const el = document.getElementById(containerId);
        if (!el) return;
        el.textContent = message;
        el.classList.toggle('hidden', !message);
    }

    function purgePlot(id) {
        const el = document.getElementById(id);
        if (el && root.Plotly) root.Plotly.purge(el);
    }

    function plot(id, traces, layout, config = {}) {
        const el = document.getElementById(id);
        if (!el || !root.Plotly) return;
        root.Plotly.react(id, traces, {
            autosize: true,
            paper_bgcolor: '#1f2933',
            plot_bgcolor: '#1f2933',
            font: { color: '#f8fafc' },
            margin: { l: 110, r: 28, t: 22, b: 58 },
            hoverlabel: { bgcolor: '#111827', bordercolor: '#334155', font: { color: '#f8fafc' } },
            ...layout
        }, { responsive: true, displayModeBar: false, ...config });
    }

    function renderScienceStatus() {
        const el = document.getElementById('scienceStatus');
        if (!el) return;
        const showUnavailable = !state.scienceAvailable && (state.mode === 'compare' || state.mode === 'science');
        el.classList.toggle('hidden', !showUnavailable);
        if (showUnavailable) {
            el.textContent = 'Science data is currently unavailable for this analysis. Art data remains available.';
        }
    }

    function renderSelectionSummary(model) {
        const container = document.getElementById('selectionSummary');
        if (!container) return;
        const focusLabel = model.focusedTopic || (state.filters.topics.length > 1 ? `${state.filters.topics.length} Topic Clusters selected` : 'All Topic Clusters');
        const geographyLabel = state.filters.country || state.filters.continent || 'All places';
        const years = state.filters.fromYear || state.filters.toYear
            ? `${state.filters.fromYear || 'earliest'}-${state.filters.toYear || 'latest'}`
            : 'All years';
        const datasets = getActiveDatasets();
        const cards = [];

        if (datasets.includes('art')) {
            const artStat = model.focusedTopic
                ? calculateTopicShare(state.artRecords, state.filters, model.focusedTopic, state.metric, { countryPopulation: state.countryPopulation })
                : { count: model.artFiltered.length, denominator: model.artBase.length, value: state.metric === 'share' ? null : model.artFiltered.length };
            cards.push(summaryCard('ART', artStat, 'artworks', model.focusedTopic));
        }
        if (datasets.includes('science')) {
            if (state.scienceAvailable) {
                const scienceStat = model.focusedTopic
                    ? calculateTopicShare(state.scienceRecords, state.filters, model.focusedTopic, state.metric, { countryPopulation: state.countryPopulation })
                    : { count: model.scienceFiltered.length, denominator: model.scienceBase.length, value: state.metric === 'share' ? null : model.scienceFiltered.length };
                cards.push(summaryCard('SCIENCE', scienceStat, 'publications', model.focusedTopic));
            } else {
                cards.push(`<div class="analysis-summary-card"><span>SCIENCE</span><strong>N/A</strong><small>Science data unavailable</small></div>`);
            }
        }

        const diffMetric = model.focusedTopic
            ? model.topicMetrics.find(item => item.topic === model.focusedTopic)
            : null;
        const difference = diffMetric?.difference != null && state.mode === 'compare'
            ? `<p class="analysis-difference">${escapeHtml(model.focusedTopic)} represents a ${formatDifferenceMagnitude(diffMetric.difference, state.metric)} ${diffMetric.difference >= 0 ? 'larger' : 'smaller'} ${state.metric === 'share' ? 'share' : 'value'} in the selected Art dataset than in the selected Science dataset.</p>`
            : '';
        const lowSupport = [diffMetric?.art, diffMetric?.science].some(stat => stat?.lowSupport)
            ? '<span class="badge badge-warning badge-outline">Low data support</span>'
            : '';

        container.innerHTML = `
            <div class="analysis-summary bg-base-200 border border-base-300">
                <div class="analysis-summary-heading">
                    <div>
                        <p class="uppercase tracking-wide text-xs opacity-70">Active selection</p>
                        <h2>${escapeHtml(focusLabel)}</h2>
                        <p>${escapeHtml(geographyLabel)} · ${escapeHtml(years)}</p>
                    </div>
                    ${lowSupport}
                </div>
                <div class="analysis-summary-cards">${cards.join('')}</div>
                ${difference}
            </div>
        `;
    }

    function summaryCard(label, stat, noun, hasTopic) {
        const primary = hasTopic
            ? formatMetricValue(stat.value, state.metric)
            : stat.count.toLocaleString();
        const support = hasTopic && state.metric === 'share'
            ? `${stat.count.toLocaleString()} / ${stat.denominator.toLocaleString()} ${noun}`
            : `${stat.count.toLocaleString()} ${noun}`;
        return `
            <div class="analysis-summary-card">
                <span>${label}</span>
                <strong>${primary}</strong>
                <small>${support}</small>
            </div>
        `;
    }

    function renderAttentionOverTime(model) {
        const chartId = 'attentionOverTimeChart';
        if (!model.focusedTopic) {
            setEmpty('attentionOverTimeEmpty', 'Select exactly one Topic Cluster to compare attention over time.');
            purgePlot(chartId);
            return;
        }
        if (!isCompareModeReady()) {
            setEmpty('attentionOverTimeEmpty', 'Science data is currently unavailable for this comparison.');
            purgePlot(chartId);
            return;
        }

        setEmpty('attentionOverTimeEmpty', '');
        const series = {
            art: state.timeSeriesMode === 'smoothed' ? smoothYearlySeries(model.yearly.art) : model.yearly.art,
            science: state.timeSeriesMode === 'smoothed' ? smoothYearlySeries(model.yearly.science) : model.yearly.science
        };
        const traces = [];
        const metricLabel = state.metric === 'share'
            ? 'share of records associated with selected topic'
            : state.metric === 'perPopulation'
                ? 'records per 1M inhabitants'
                : 'unique records';

        if (getActiveDatasets().includes('art')) {
            traces.push(yearlyTrace('Art', series.art, ART_SERIES_COLOR, 'circle', 'solid'));
        }
        if (getActiveDatasets().includes('science') && state.scienceAvailable) {
            traces.push(yearlyTrace('Science', series.science, SCIENCE_SERIES_COLOR, 'diamond', 'dash'));
        }
        if (traces.every(trace => trace.x.length === 0)) {
            setEmpty('attentionOverTimeEmpty', 'No yearly records match this selection.');
            purgePlot(chartId);
            return;
        }

        plot(chartId, traces, {
            xaxis: { title: 'Year', showgrid: false, zeroline: false },
            yaxis: { title: metricLabel, rangemode: 'tozero', ticksuffix: state.metric === 'share' ? '%' : '' },
            legend: { orientation: 'h', y: -0.25 }
        });
    }

    function yearlyTrace(name, series, color, symbol, dash) {
        return {
            x: series.map(point => point.year),
            y: series.map(point => point.value),
            customdata: series.map(point => [point.count, point.denominator, point.lowSupport ? 'Low data support' : '']),
            name,
            type: 'scatter',
            mode: 'lines+markers',
            line: { color, width: 3, dash },
            marker: { color, symbol, size: 8 },
            hovertemplate: `%{x}<br>${name}<br>%{customdata[0]} / %{customdata[1]} records<br>${state.metric === 'share' ? '%{y:.2f}%' : '%{y:.3f}'}<br>%{customdata[2]}<extra></extra>`
        };
    }

    function renderTemporalShift(model) {
        const chartId = 'temporalShiftChart';
        if (state.mode !== 'compare') {
            setEmpty('temporalShiftEmpty', 'Temporal shift is shown in COMPARE mode.');
            purgePlot(chartId);
            return;
        }
        if (!state.scienceAvailable) {
            setEmpty('temporalShiftEmpty', 'Science data is currently unavailable for temporal shift.');
            purgePlot(chartId);
            return;
        }
        const rows = model.temporal.filter(item => item.supported && item.shift != null).slice(0, 10);
        if (rows.length === 0) {
            setEmpty('temporalShiftEmpty', 'Not enough temporal data to estimate a shift reliably.');
            purgePlot(chartId);
            return;
        }
        setEmpty('temporalShiftEmpty', '');
        const lineTraces = rows.map(row => ({
            x: [row.scienceCenter, row.artCenter],
            y: [row.topic, row.topic],
            mode: 'lines',
            type: 'scatter',
            showlegend: false,
            line: { color: state.clusterColors[row.topic] || '#94a3b8', width: 4 },
            hoverinfo: 'skip'
        }));
        const traces = [
            ...lineTraces,
            {
                x: rows.map(row => row.scienceCenter),
                y: rows.map(row => row.topic),
                name: 'Science attention center',
                mode: 'markers',
                type: 'scatter',
                marker: { color: SCIENCE_SERIES_COLOR, symbol: 'circle', size: 12, line: { color: '#ecfeff', width: 1 } },
                customdata: rows.map(row => [row.shift]),
                hovertemplate: '%{y}<br>Science center: %{x}<br>Temporal shift: %{customdata[0]} years<extra></extra>'
            },
            {
                x: rows.map(row => row.artCenter),
                y: rows.map(row => row.topic),
                name: 'Art attention center',
                mode: 'markers',
                type: 'scatter',
                marker: { color: ART_SERIES_COLOR, symbol: 'diamond', size: 13, line: { color: '#fffbeb', width: 1 } },
                customdata: rows.map(row => [row.shift]),
                hovertemplate: '%{y}<br>Art center: %{x}<br>Temporal shift: %{customdata[0]} years<extra></extra>'
            }
        ];
        plot(chartId, traces, {
            xaxis: { title: 'Attention center year', showgrid: true, zeroline: false, dtick: 2 },
            yaxis: { automargin: true, autorange: 'reversed' },
            legend: { orientation: 'h', y: -0.25 }
        });
        attachTopicClick(chartId);
    }

    function renderTopicRepresentation(model) {
        const chartId = 'topicRepresentationChart';
        const rows = model.topicMetrics
            .filter(item => item.art.denominator > 0 || item.science.denominator > 0)
            .sort((a, b) => Math.max(b.art.value || 0, b.science.value || 0) - Math.max(a.art.value || 0, a.science.value || 0))
            .slice(0, 12);
        if (rows.length === 0) {
            setEmpty('topicRepresentationEmpty', 'No topic records match this selection.');
            purgePlot(chartId);
            return;
        }
        setEmpty('topicRepresentationEmpty', '');
        const traces = [];
        if (getActiveDatasets().includes('art')) {
            traces.push({
                x: rows.map(row => state.mode === 'compare' ? -(row.art.value || 0) : row.art.value),
                y: rows.map(row => row.topic),
                name: 'Art',
                type: 'bar',
                orientation: 'h',
                marker: { color: rows.map(row => state.clusterColors[row.topic] || ART_SERIES_COLOR), opacity: 0.85, line: { color: ART_SERIES_COLOR, width: 1 } },
                customdata: rows.map(row => [row.art.count, row.art.denominator, row.art.lowSupport ? 'Low data support' : '']),
                hovertemplate: '%{y}<br>Art<br>%{customdata[0]} / %{customdata[1]} records<br>' + (state.metric === 'share' ? '%{x:.2f}%' : '%{x:.3f}') + '<br>%{customdata[2]}<extra></extra>'
            });
        }
        if (getActiveDatasets().includes('science') && state.scienceAvailable) {
            traces.push({
                x: rows.map(row => row.science.value || 0),
                y: rows.map(row => row.topic),
                name: 'Science',
                type: 'bar',
                orientation: 'h',
                marker: { color: rows.map(row => state.clusterColors[row.topic] || SCIENCE_NEUTRAL_COLOR), opacity: 0.55, line: { color: SCIENCE_SERIES_COLOR, width: 1 } },
                customdata: rows.map(row => [row.science.count, row.science.denominator, row.science.lowSupport ? 'Low data support' : '']),
                hovertemplate: '%{y}<br>Science<br>%{customdata[0]} / %{customdata[1]} records<br>' + (state.metric === 'share' ? '%{x:.2f}%' : '%{x:.3f}') + '<br>%{customdata[2]}<extra></extra>'
            });
        }
        plot(chartId, traces, {
            barmode: 'relative',
            xaxis: {
                title: state.mode === 'compare' ? 'Art left · Science right' : metricAxisTitle(),
                ticksuffix: state.metric === 'share' ? '%' : '',
                zeroline: true,
                zerolinecolor: '#f8fafc'
            },
            yaxis: { automargin: true, autorange: 'reversed' },
            legend: { orientation: 'h', y: -0.25 }
        });
        attachTopicClick(chartId);
    }

    function renderTopicDifference(model) {
        const chartId = 'topicDifferenceChart';
        if (state.mode !== 'compare') {
            setEmpty('topicDifferenceEmpty', 'Topic difference is shown in COMPARE mode.');
            purgePlot(chartId);
            return;
        }
        if (!state.scienceAvailable) {
            setEmpty('topicDifferenceEmpty', 'Science data is currently unavailable for topic differences.');
            purgePlot(chartId);
            return;
        }
        const rows = model.topicMetrics
            .filter(item => item.difference != null)
            .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference) || a.topic.localeCompare(b.topic))
            .slice(0, 14);
        if (rows.length === 0) {
            setEmpty('topicDifferenceEmpty', 'No comparable topic values for this selection.');
            purgePlot(chartId);
            return;
        }
        setEmpty('topicDifferenceEmpty', '');
        plot(chartId, [{
            x: rows.map(row => row.difference),
            y: rows.map(row => row.topic),
            type: 'bar',
            orientation: 'h',
            marker: { color: rows.map(row => row.difference >= 0 ? ART_SERIES_COLOR : SCIENCE_SERIES_COLOR) },
            customdata: rows.map(row => [row.art.count, row.art.denominator, row.science.count, row.science.denominator]),
            hovertemplate: '%{y}<br>Difference: %{x:.2f}<br>Art: %{customdata[0]} / %{customdata[1]}<br>Science: %{customdata[2]} / %{customdata[3]}<extra></extra>'
        }], {
            xaxis: {
                title: state.metric === 'share' ? 'Higher Art share ← percentage-point difference → Higher Science share' : 'Art value minus Science value',
                zeroline: true,
                zerolinecolor: '#f8fafc',
                ticksuffix: state.metric === 'share' ? ' pp' : ''
            },
            yaxis: { automargin: true, autorange: 'reversed' }
        });
        attachTopicClick(chartId);
    }

    function renderGeographicDifference(model) {
        const chartId = 'geographicDifferenceChart';
        if (state.mode !== 'compare') {
            setEmpty('geographicDifferenceEmpty', 'Geographic difference is shown in COMPARE mode.');
            purgePlot(chartId);
            return;
        }
        if (!model.focusedTopic) {
            setEmpty('geographicDifferenceEmpty', 'Select exactly one Topic Cluster to rank geographic differences.');
            purgePlot(chartId);
            return;
        }
        if (!state.scienceAvailable) {
            setEmpty('geographicDifferenceEmpty', 'Science data is currently unavailable for geographic differences.');
            purgePlot(chartId);
            return;
        }
        if (model.geographic.length === 0) {
            setEmpty('geographicDifferenceEmpty', 'No comparable geographic values for this selection.');
            purgePlot(chartId);
            return;
        }
        setEmpty('geographicDifferenceEmpty', '');
        plot(chartId, [{
            x: model.geographic.map(item => item.difference),
            y: model.geographic.map(item => item.label),
            type: 'bar',
            orientation: 'h',
            marker: { color: model.geographic.map(item => item.difference >= 0 ? ART_SERIES_COLOR : SCIENCE_SERIES_COLOR) },
            customdata: model.geographic.map(item => [item.art.count, item.art.denominator, item.science.count, item.science.denominator]),
            hovertemplate: '%{y}<br>Difference: %{x:.2f}<br>Art: %{customdata[0]} / %{customdata[1]}<br>Science: %{customdata[2]} / %{customdata[3]}<extra></extra>'
        }], {
            xaxis: {
                title: state.metric === 'share' ? 'Higher Art share ← percentage-point difference → Higher Science share' : 'Art value minus Science value',
                zeroline: true,
                zerolinecolor: '#f8fafc',
                ticksuffix: state.metric === 'share' ? ' pp' : ''
            },
            yaxis: { automargin: true, autorange: 'reversed' }
        });
        const el = document.getElementById(chartId);
        el?.on?.('plotly_click', event => {
            const label = event.points?.[0]?.y;
            if (!label) return;
            if (state.geographyMode === 'countries') {
                document.getElementById('countrySelect').value = label;
            } else {
                document.getElementById('continentSelect').value = label;
                document.getElementById('countrySelect').value = '';
            }
            updateFromControls();
        });
    }

    function renderInterestingPatterns(model) {
        const container = document.getElementById('interestingPatterns');
        if (!container) return;
        const patterns = [];
        const diff = model.topicMetrics
            .filter(item => item.difference != null && !item.art.lowSupport && !item.science.lowSupport)
            .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))[0];
        if (state.mode === 'compare' && diff && Math.abs(diff.difference) >= (state.metric === 'share' ? 5 : 1)) {
            patterns.push({
                type: 'Topic difference',
                title: diff.topic,
                body: `${diff.difference >= 0 ? 'Art' : 'Science'} has a higher ${state.metric === 'share' ? 'share' : 'value'} in this selection (${formatDifference(Math.abs(diff.difference), state.metric)} difference).`
            });
        }
        const shift = model.temporal.find(item => item.supported && item.shift != null && Math.abs(item.shift) >= 2);
        if (state.mode === 'compare' && shift) {
            patterns.push({
                type: 'Temporal shift',
                title: shift.topic,
                body: `The center of ${shift.shift > 0 ? 'Science representation occurs earlier than Art' : 'Art representation occurs earlier than Science'} in this selection.`
            });
        }
        const similar = model.topicMetrics
            .filter(item => item.difference != null && Math.abs(item.difference) <= (state.metric === 'share' ? 2 : 1) && item.art.count > 0 && item.science.count > 0)
            .sort((a, b) => Math.abs(a.difference) - Math.abs(b.difference))[0];
        if (state.mode === 'compare' && similar) {
            patterns.push({
                type: 'Similar representation',
                title: similar.topic,
                body: `Art and Science have similar representation for this topic in the selected context.`
            });
        }

        if (patterns.length === 0) {
            container.innerHTML = '<div class="analysis-empty">No strong rule-based patterns for the current selection.</div>';
            return;
        }

        container.innerHTML = patterns.map(pattern => `
            <button class="analysis-pattern bg-base-200 border border-base-300" type="button" data-topic="${escapeHtml(pattern.title)}">
                <span>${escapeHtml(pattern.type)}</span>
                <strong>${escapeHtml(pattern.title)}</strong>
                <small>${escapeHtml(pattern.body)}</small>
            </button>
        `).join('');
        container.querySelectorAll('[data-topic]').forEach(button => {
            button.addEventListener('click', () => setSelectedTopic(button.dataset.topic));
        });
    }

    function renderThemeRelationships(model) {
        const records = state.relationshipMode === 'science' ? model.scienceFiltered : model.artFiltered;
        const container = document.getElementById('coOccurrenceNetwork');
        if (!container || !root.vis) return;
        const nodes = [];
        const edges = [];
        const nodeSet = new Set();
        const edgeCounts = new Map();

        records.forEach(record => {
            const clusters = uniq(record.clusters).sort();
            clusters.forEach(cluster => {
                if (!nodeSet.has(cluster)) {
                    nodeSet.add(cluster);
                    nodes.push({ id: cluster, label: cluster, color: state.clusterColors[cluster] || '#94a3b8', font: { color: '#f8fafc' } });
                }
            });
            for (let i = 0; i < clusters.length; i += 1) {
                for (let j = i + 1; j < clusters.length; j += 1) {
                    const key = [clusters[i], clusters[j]].sort().join('::');
                    edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
                }
            }
        });

        edgeCounts.forEach((value, key) => {
            const [from, to] = key.split('::');
            edges.push({ from, to, value, title: `${value} co-occurrence(s)` });
        });

        if (nodes.length === 0) {
            setEmpty('themeRelationshipsEmpty', `No ${state.relationshipMode === 'science' ? 'Science' : 'Art'} records available for this relationship view.`);
            container.innerHTML = '';
            return;
        }
        setEmpty('themeRelationshipsEmpty', '');
        state.network = new root.vis.Network(container, {
            nodes: new root.vis.DataSet(nodes),
            edges: new root.vis.DataSet(edges)
        }, {
            nodes: { shape: 'dot', size: 14 },
            edges: { color: { color: '#94a3b8' }, smooth: { type: 'continuous' } },
            physics: { stabilization: true }
        });
    }

    function renderEvidence(model) {
        const container = document.getElementById('evidenceList');
        if (!container) return;
        const records = state.evidenceMode === 'science' ? model.scienceFiltered : model.artFiltered;
        const noun = state.evidenceMode === 'science' ? 'publications' : 'artworks';
        if (records.length === 0) {
            container.innerHTML = `<div class="analysis-empty">No matching ${noun} for this selection.</div>`;
            return;
        }

        container.innerHTML = records.slice(0, MAX_EVIDENCE_ITEMS).map(record => `
            <article class="analysis-evidence-item bg-base-200 border border-base-300">
                <div>
                    <h3>${escapeHtml(record.title)}</h3>
                    <p>${escapeHtml([record.creator, record.year, record.location].filter(Boolean).join(' · '))}</p>
                    <small>${escapeHtml(record.clusters.join(', ') || 'No topic cluster')}</small>
                </div>
                ${record.url ? `<a class="btn btn-xs btn-outline btn-primary" href="${escapeHtml(record.url)}" target="_blank" rel="noopener">Open</a>` : ''}
            </article>
        `).join('') + (records.length > MAX_EVIDENCE_ITEMS ? `<p class="text-sm opacity-70 mt-3">Showing ${MAX_EVIDENCE_ITEMS} of ${records.length.toLocaleString()} matching ${noun}.</p>` : '');
    }

    function metricAxisTitle() {
        if (state.metric === 'share') return 'Share of records associated with topic';
        if (state.metric === 'perPopulation') return 'Records per 1M inhabitants';
        return 'Unique records';
    }

    function attachTopicClick(chartId) {
        const el = document.getElementById(chartId);
        el?.on?.('plotly_click', event => {
            const topic = event.points?.[0]?.y;
            if (topic && state.topicClusters[topic]) setSelectedTopic(topic);
        });
    }

    function setSelectedTopic(topic) {
        const select = document.getElementById('topicClusterSelect');
        Array.from(select.options).forEach(option => {
            option.selected = option.value === topic;
        });
        updateFromControls();
    }

    function updateCountryOptions() {
        const countrySelect = document.getElementById('countrySelect');
        const current = countrySelect.value;
        Array.from(countrySelect.options).forEach(option => {
            if (!option.value) return;
            const continent = state.continentMapping[option.value] || 'Other';
            option.hidden = Boolean(state.filters.continent && continent !== state.filters.continent);
        });
        if (current && countrySelect.selectedOptions[0]?.hidden) countrySelect.value = '';
    }

    function selectedMultiValues(select) {
        const values = Array.from(select.selectedOptions).map(option => option.value).filter(Boolean);
        return values.includes('') ? [] : values;
    }

    function updateFromControls(pushUrl = true) {
        state.mode = document.querySelector('input[name="analysisMode"]:checked')?.value || 'compare';
        state.metric = document.querySelector('input[name="metricMode"]:checked')?.value || 'share';
        state.geographyMode = document.querySelector('input[name="geographyMode"]:checked')?.value || 'countries';
        state.relationshipMode = document.querySelector('input[name="relationshipMode"]:checked')?.value || 'art';
        state.evidenceMode = document.querySelector('input[name="evidenceMode"]:checked')?.value || 'art';
        state.timeSeriesMode = document.querySelector('input[name="timeSeriesMode"]:checked')?.value || 'raw';
        state.filters.continent = document.getElementById('continentSelect').value;
        state.filters.country = document.getElementById('countrySelect').value;
        state.filters.topics = selectedMultiValues(document.getElementById('topicClusterSelect'));
        state.filters.fromYear = toNumber(document.getElementById('yearFrom').value);
        state.filters.toYear = toNumber(document.getElementById('yearTo').value);

        updateCountryOptions();
        if (pushUrl) writeUrlState();
        renderAll();
    }

    function renderAll() {
        const model = buildAnalysisModel();
        renderScienceStatus();
        renderSelectionSummary(model);
        renderAttentionOverTime(model);
        renderTemporalShift(model);
        renderTopicRepresentation(model);
        renderTopicDifference(model);
        renderGeographicDifference(model);
        renderInterestingPatterns(model);
        renderThemeRelationships(model);
        renderEvidence(model);
    }

    function populateSelects() {
        const continentSelect = document.getElementById('continentSelect');
        const countrySelect = document.getElementById('countrySelect');
        const topicSelect = document.getElementById('topicClusterSelect');
        const continents = uniq([
            ...Object.values(state.continentMapping),
            ...state.artRecords.map(record => record.continent),
            ...state.scienceRecords.map(record => record.continent)
        ]).sort();
        const countries = uniq([
            ...Object.keys(state.continentMapping),
            ...state.artRecords.map(record => record.country),
            ...state.scienceRecords.map(record => record.country)
        ]).filter(country => country !== 'Other').sort();

        continents.forEach(continent => continentSelect.add(new Option(continent, continent)));
        countries.forEach(country => countrySelect.add(new Option(country, country)));
        Object.keys(state.topicClusters).sort().forEach(cluster => topicSelect.add(new Option(cluster, cluster)));
    }

    function readUrlState() {
        const params = new URLSearchParams(root.location.search);
        const topicParam = params.get('topics') || params.get('topic') || params.get('cluster') || params.get('topicCluster');
        const mode = params.get('mode');
        const metric = params.get('metric');
        const fromYear = toNumber(params.get('from') || params.get('yearFrom'));
        const toYear = toNumber(params.get('to') || params.get('yearTo'));

        if (['art', 'science', 'compare'].includes(mode)) {
            document.querySelector(`input[name="analysisMode"][value="${mode}"]`).checked = true;
        }
        if (['share', 'absolute', 'perPopulation', 'perCapita', 'total'].includes(metric)) {
            const normalizedMetric = metric === 'perCapita' ? 'perPopulation' : metric === 'total' ? 'absolute' : metric;
            document.querySelector(`input[name="metricMode"][value="${normalizedMetric}"]`).checked = true;
        }
        document.getElementById('continentSelect').value = params.get('continent') || '';
        document.getElementById('countrySelect').value = params.get('country') || '';
        document.getElementById('yearFrom').value = fromYear != null && fromYear >= 1600 ? fromYear : '';
        document.getElementById('yearTo').value = toYear != null && toYear >= 1600 ? toYear : '';

        if (topicParam) {
            const requested = topicParam.split(',').map(value => value.trim()).filter(Boolean);
            const select = document.getElementById('topicClusterSelect');
            Array.from(select.options).forEach(option => {
                option.selected = requested.includes(option.value);
            });
        }
    }

    function writeUrlState() {
        const params = new URLSearchParams();
        if (state.mode !== 'compare') params.set('mode', state.mode);
        if (state.metric !== 'share') params.set('metric', state.metric);
        if (state.filters.continent) params.set('continent', state.filters.continent);
        if (state.filters.country) params.set('country', state.filters.country);
        if (state.filters.topics.length > 0) params.set('topics', state.filters.topics.join(','));
        if (state.filters.fromYear != null) params.set('from', state.filters.fromYear);
        if (state.filters.toYear != null) params.set('to', state.filters.toYear);
        const query = params.toString();
        const next = `${root.location.pathname}${query ? `?${query}` : ''}`;
        root.history.replaceState({}, '', next);
    }

    function resetFilters() {
        document.querySelector('input[name="analysisMode"][value="compare"]').checked = true;
        document.querySelector('input[name="metricMode"][value="share"]').checked = true;
        document.querySelector('input[name="timeSeriesMode"][value="raw"]').checked = true;
        document.querySelector('input[name="geographyMode"][value="countries"]').checked = true;
        document.querySelector('input[name="relationshipMode"][value="art"]').checked = true;
        document.querySelector('input[name="evidenceMode"][value="art"]').checked = true;
        document.getElementById('continentSelect').value = '';
        document.getElementById('countrySelect').value = '';
        document.getElementById('yearFrom').value = '';
        document.getElementById('yearTo').value = '';
        Array.from(document.getElementById('topicClusterSelect').options).forEach(option => {
            option.selected = option.value === '';
        });
        updateFromControls();
    }

    function wireControls() {
        [
            'continentSelect',
            'countrySelect',
            'topicClusterSelect',
            'yearFrom',
            'yearTo'
        ].forEach(id => document.getElementById(id).addEventListener('change', () => updateFromControls()));
        [
            'analysisMode',
            'metricMode',
            'timeSeriesMode',
            'geographyMode',
            'relationshipMode',
            'evidenceMode'
        ].forEach(name => {
            document.querySelectorAll(`input[name="${name}"]`).forEach(input => {
                input.addEventListener('change', () => updateFromControls());
            });
        });
        document.getElementById('resetFilters').addEventListener('click', resetFilters);
        document.getElementById('methodologyButton').addEventListener('click', () => {
            document.getElementById('methodologyDialog')?.showModal();
        });
    }

    async function boot() {
        const ecoData = root.EcoData;
        if (!ecoData) {
            document.getElementById('scienceStatus').classList.remove('hidden');
            document.getElementById('scienceStatus').textContent = 'Shared data utilities could not be loaded.';
            return;
        }

        const { artworkData, topicClusters, continentMapping, countryPopulation } = await ecoData.loadSharedData();
        const scienceMapData = await ecoData.loadScienceMapData();
        state.topicClusters = topicClusters;
        state.continentMapping = continentMapping;
        state.countryPopulation = countryPopulation;
        state.clusterColors = ecoData.getClusterColors(topicClusters);
        state.artRecords = normalizeArtRecords(artworkData, { ecoData, topicClusters, continentMapping, countryPopulation });
        state.scienceRecords = normalizeScienceRecords(scienceMapData, { ecoData, topicClusters, continentMapping, countryPopulation });
        state.scienceAvailable = Boolean(scienceMapData && state.scienceRecords.length > 0);

        populateSelects();
        readUrlState();
        wireControls();
        updateFromControls(false);
    }

    const api = {
        LOW_SUPPORT_DENOMINATOR,
        TEMPORAL_SHIFT_MIN_RECORDS,
        TEMPORAL_SHIFT_MIN_YEARS,
        normalizeArtRecords,
        normalizeScienceRecords,
        recordPassesBase,
        uniqueRecords,
        countUnique,
        calculateTopicShare,
        calculateYearlyTopicShares,
        calculateAttentionCenter,
        calculateTemporalShift,
        calculateTopicMetrics,
        calculateGeographicDifferences,
        smoothYearlySeries
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    root.EcoDataAnalysis = api;

    if (typeof document !== 'undefined') {
        document.addEventListener('DOMContentLoaded', () => {
            boot().catch(error => {
                console.error('Could not initialize Data Analysis page:', error);
                const status = document.getElementById('scienceStatus');
                if (status) {
                    status.classList.remove('hidden');
                    status.textContent = `Could not load analysis data: ${error.message}`;
                }
            });
        });
    }
})(typeof window !== 'undefined' ? window : globalThis);
