mapboxgl.accessToken = 'pk.eyJ1IjoicGVpc2thc3NpbyIsImEiOiJjbTM4eHB5NHIwd2M5MmlxeGlsOTRqams5In0.hEmqLEzaR2kWC2s7Hgd-Ng';

let artworkData = { type: 'FeatureCollection', features: [] };
let topicClusters = {};
let continentMapping = {};
let countryPopulation = {};
let enrichedFeatures = [];
let scienceMapData = null;
let scienceRecords = [];
let nonPlaceableScienceRecords = [];
let globalScienceRecords = [];
let groupedFeatureLookup = new Map();
let groupedScienceLookup = new Map();
let activeArtworkPopup = null;
let activeSciencePopup = null;
const {
    loadSharedData,
    loadScienceMapData,
    normalizeText,
    parseYear
} = EcoData;

const SCIENCE_CIRCLE_MIN_RADIUS = 10;
const SCIENCE_CIRCLE_MAX_RADIUS = 32;
const SCIENCE_NEUTRAL_COLOR = '#14b8a6';
const SCIENCE_NEUTRAL_CORE_COLOR = '#0f766e';
const SCIENCE_NEUTRAL_STROKE_COLOR = '#ccfbf1';
const SCIENCE_SELECTED_STROKE_WIDTH = 4;
const SCIENCE_DEFAULT_STROKE_WIDTH = 2;
const SCIENCE_RING_IMAGE_SIZE = 96;
const SCIENCE_RING_VISIBLE_DIAMETER = 86;
const SCIENCE_RING_RADIUS = 38;
const SCIENCE_RING_WIDTH = 10;

let selectedScienceGroupKey = null;

const globe = new mapboxgl.Map({
    container: 'globeMap',
    style: 'mapbox://styles/mapbox/dark-v11',
    center: [12, 18],
    zoom: 1.25,
    projection: 'globe',
    attributionControl: false
});

globe.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
globe.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left');

function escapeHtml(value) {
    return (value || '')
        .toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getThumbnailHtml(thumbnail, className = 'globe-popup-thumbnail') {
    const thumbnailUrl = (thumbnail || '').toString().trim();

    if (!/^https?:\/\/[^\s"'<>]+$/i.test(thumbnailUrl)) {
        return '';
    }

    return `<img class="${escapeHtml(className)}" src="${escapeHtml(thumbnailUrl)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
}

function getDescriptionExcerpt(description, maxLength = 180) {
    const normalizedDescription = (description || '').toString().trim().replace(/\s+/g, ' ');

    if (!normalizedDescription) {
        return '';
    }

    if (normalizedDescription.length <= maxLength) {
        return normalizedDescription;
    }

    const truncated = normalizedDescription.slice(0, maxLength).trimEnd();
    const lastSpaceIndex = truncated.lastIndexOf(' ');
    const excerpt = lastSpaceIndex > Math.floor(maxLength * 0.6)
        ? truncated.slice(0, lastSpaceIndex).trimEnd()
        : truncated;

    return `${excerpt}...`;
}

function getValidUrl(value) {
    const url = (value || '').toString().trim();

    return /^https?:\/\/[^\s"'<>]+$/i.test(url) ? url : '';
}

function getPrimaryArtform(props = {}) {
    const artforms = props.tags?.artform;
    const fallbackType = (props.type || '').toString().split('/')[0].trim();

    if (Array.isArray(artforms)) {
        return (artforms[0] || '').toString().trim() || fallbackType;
    }

    return (artforms || '').toString().split(',')[0].trim() || fallbackType;
}

function getCountryFromLocation(location) {
    return EcoData.getCountryFromLocation(location, continentMapping, countryPopulation);
}

function getContinentForCountry(country) {
    return EcoData.getContinentForCountry(country, continentMapping);
}

function getArtworkClusters(feature) {
    return EcoData.getArtworkClusters(feature, topicClusters);
}

function getClusterColor(cluster) {
    return EcoData.getClusterColor(cluster, topicClusters);
}

function getMetricMode() {
    return document.querySelector('input[name="globeMetric"]:checked')?.value || 'total';
}

function getMapMode() {
    return document.querySelector('input[name="globeMode"]:checked')?.value || 'art';
}

function getSelectedClusters() {
    const select = document.getElementById('globeCluster');
    if (!select) return [];

    return Array.from(select.selectedOptions)
        .map(option => option.value)
        .filter(Boolean);
}

function resetClusterFilter() {
    const select = document.getElementById('globeCluster');
    Array.from(select.options).forEach(option => {
        option.selected = option.value === '';
    });
}

function getMetricLabel() {
    return getMetricMode() === 'perCapita' ? 'per 1M people' : 'total';
}

function normalizeValue(count, population) {
    return EcoData.normalizePerCapita(count, population, getMetricMode()) ?? 0;
}

function isValidPoint(feature) {
    const coordinates = feature.geometry?.coordinates || [];
    return Number.isFinite(coordinates[0]) && Number.isFinite(coordinates[1]);
}

function enrichFeature(feature) {
    return EcoData.enrichArtwork(feature, { topicClusters, continentMapping, countryPopulation });
}

function normalizeScienceRecord(record = {}) {
    const latitude = record.latitude == null || record.latitude === '' ? null : Number(record.latitude);
    const longitude = record.longitude == null || record.longitude === '' ? null : Number(record.longitude);
    const displayLatitude = record.displayLatitude == null || record.displayLatitude === '' ? null : Number(record.displayLatitude);
    const displayLongitude = record.displayLongitude == null || record.displayLongitude === '' ? null : Number(record.displayLongitude);

    return {
        ...record,
        publicationId: record.publicationId == null ? null : record.publicationId,
        studyAreaId: record.studyAreaId == null ? null : record.studyAreaId,
        year: parseYear(record.year),
        country: record.country || 'Other',
        continent: record.continent || getContinentForCountry(record.country || 'Other'),
        latitude: Number.isFinite(latitude) ? latitude : null,
        longitude: Number.isFinite(longitude) ? longitude : null,
        displayLatitude: Number.isFinite(displayLatitude) ? displayLatitude : null,
        displayLongitude: Number.isFinite(displayLongitude) ? displayLongitude : null,
        topicClusters: Array.isArray(record.topicClusters) ? record.topicClusters : [],
        topics: Array.isArray(record.topics) ? record.topics : []
    };
}

function getFilteredFeatures() {
    const query = normalizeText(document.getElementById('globeSearch').value.trim());
    const selectedClusters = getSelectedClusters();
    const continent = document.getElementById('globeContinent').value;
    const country = document.getElementById('globeCountry').value;
    const fromYear = parseInt(document.getElementById('globeYearFrom').value, 10);
    const toYear = parseInt(document.getElementById('globeYearTo').value, 10);

    return enrichedFeatures.filter(feature => {
        const props = feature.properties || {};
        const year = parseYear(props.year);
        const text = normalizeText(`${props.title} ${props.artist} ${props.location} ${props.description}`);

        if (!isValidPoint(feature)) return false;
        if (query && !text.includes(query)) return false;
        if (selectedClusters.length > 0 && !selectedClusters.some(cluster => (props.clusters || []).includes(cluster))) return false;
        if (continent && props.continent !== continent) return false;
        if (country && props.country !== country) return false;
        if (!Number.isNaN(fromYear) && year !== null && year < fromYear) return false;
        if (!Number.isNaN(toYear) && year !== null && year > toYear) return false;
        return true;
    });
}

function getFilteredScienceRecords(records = scienceRecords) {
    const query = normalizeText(document.getElementById('globeSearch').value.trim());
    const selectedClusters = getSelectedClusters();
    const continent = document.getElementById('globeContinent').value;
    const country = document.getElementById('globeCountry').value;
    const fromYear = parseInt(document.getElementById('globeYearFrom').value, 10);
    const toYear = parseInt(document.getElementById('globeYearTo').value, 10);

    return records.filter(record => {
        const year = parseYear(record.year);
        const topics = Array.isArray(record.topics) ? record.topics : [];
        const clusters = Array.isArray(record.topicClusters) ? record.topicClusters : [];
        const text = normalizeText(`${record.country} ${record.region} ${record.city} ${topics.join(' ')} ${clusters.join(' ')}`);

        if (query && !text.includes(query)) return false;
        if (selectedClusters.length > 0 && !selectedClusters.some(cluster => clusters.includes(cluster))) return false;
        if (continent && record.continent !== continent) return false;
        if (country && record.country !== country) return false;
        if (!Number.isNaN(fromYear) && year !== null && year < fromYear) return false;
        if (!Number.isNaN(toYear) && year !== null && year > toYear) return false;
        return true;
    });
}

function aggregateByCountry(features) {
    const data = {};

    features.forEach(feature => {
        const country = feature.properties.country || 'Other';
        if (!data[country]) {
            data[country] = {
                label: country,
                count: 0,
                population: countryPopulation[country] || 0
            };
        }
        data[country].count += 1;
    });

    Object.values(data).forEach(item => {
        item.value = normalizeValue(item.count, item.population);
    });

    return data;
}

function aggregateByContinent(features) {
    const data = {};

    features.forEach(feature => {
        const country = feature.properties.country || 'Other';
        const continent = feature.properties.continent || 'Other';
        if (!data[continent]) {
            data[continent] = {
                label: continent,
                count: 0,
                countries: new Set()
            };
        }
        data[continent].count += 1;
        if (country !== 'Other') data[continent].countries.add(country);
    });

    Object.values(data).forEach(item => {
        const population = Array.from(item.countries).reduce((sum, country) => sum + (countryPopulation[country] || 0), 0);
        item.value = normalizeValue(item.count, population);
    });

    return data;
}

function aggregateScienceByCountry(records) {
    const data = {};

    records.forEach(record => {
        const country = record.country || 'Other';
        if (!data[country]) {
            data[country] = {
                label: country,
                count: 0,
                publicationIds: new Set(),
                population: countryPopulation[country] || 0
            };
        }
        if (record.publicationId != null) {
            data[country].publicationIds.add(record.publicationId);
        }
    });

    Object.values(data).forEach(item => {
        item.count = item.publicationIds.size;
        item.value = normalizeValue(item.count, item.population);
    });

    return data;
}

function aggregateScienceByContinent(records) {
    const data = {};

    records.forEach(record => {
        const country = record.country || 'Other';
        const continent = record.continent || 'Other';
        if (!data[continent]) {
            data[continent] = {
                label: continent,
                count: 0,
                publicationIds: new Set(),
                countries: new Set()
            };
        }
        if (record.publicationId != null) {
            data[continent].publicationIds.add(record.publicationId);
        }
        if (country !== 'Other') data[continent].countries.add(country);
    });

    Object.values(data).forEach(item => {
        const population = Array.from(item.countries).reduce((sum, country) => sum + (countryPopulation[country] || 0), 0);
        item.count = item.publicationIds.size;
        item.value = normalizeValue(item.count, population);
    });

    return data;
}

function getUniquePublicationCount(records) {
    return new Set(records.map(record => record.publicationId).filter(id => id != null)).size;
}

function getUniquePublicationIds(records) {
    return new Set(records.map(record => record.publicationId).filter(id => id != null));
}

function getScienceCircleRadius(count, maxCount) {
    if (count <= 0) return 0;
    if (maxCount <= 1) return SCIENCE_CIRCLE_MIN_RADIUS;

    const scaled = (Math.sqrt(count) - 1) / (Math.sqrt(maxCount) - 1);
    return SCIENCE_CIRCLE_MIN_RADIUS + (scaled * (SCIENCE_CIRCLE_MAX_RADIUS - SCIENCE_CIRCLE_MIN_RADIUS));
}

function getScienceClusterColor(clusterNames, selectedClusters = getSelectedClusters()) {
    if (selectedClusters.length === 1) {
        return getClusterColor(selectedClusters[0]);
    }

    if (selectedClusters.length === 0 && clusterNames.length === 1) {
        return getClusterColor(clusterNames[0]);
    }

    return SCIENCE_NEUTRAL_COLOR;
}

function getScienceClusterBreakdown(records) {
    const breakdown = new Map();

    records.forEach(record => {
        (record.topicClusters || []).forEach(cluster => {
            if (!breakdown.has(cluster)) breakdown.set(cluster, new Set());
            if (record.publicationId != null) breakdown.get(cluster).add(record.publicationId);
        });
    });

    return Array.from(breakdown.entries())
        .map(([cluster, publicationIds]) => ({
            cluster,
            count: publicationIds.size,
            color: getClusterColor(cluster)
        }))
        .sort((a, b) => b.count - a.count || a.cluster.localeCompare(b.cluster));
}

function getScienceClusterShares(records, selectedClusters = getSelectedClusters()) {
    const selectedClusterSet = new Set(selectedClusters);
    const publicationClusters = new Map();

    records.forEach(record => {
        if (record.publicationId == null) return;

        const clusters = (record.topicClusters || [])
            .filter(cluster => selectedClusterSet.size === 0 || selectedClusterSet.has(cluster));

        if (clusters.length === 0) return;
        if (!publicationClusters.has(record.publicationId)) {
            publicationClusters.set(record.publicationId, new Set());
        }

        clusters.forEach(cluster => publicationClusters.get(record.publicationId).add(cluster));
    });

    const weightedClusters = new Map();

    publicationClusters.forEach(clusterSet => {
        const clusters = Array.from(clusterSet).sort();
        const clusterWeight = 1 / clusters.length;

        clusters.forEach(cluster => {
            weightedClusters.set(cluster, (weightedClusters.get(cluster) || 0) + clusterWeight);
        });
    });

    const totalWeight = Array.from(weightedClusters.values()).reduce((sum, weight) => sum + weight, 0);

    return Array.from(weightedClusters.entries())
        .map(([cluster, value]) => ({
            cluster,
            value,
            share: totalWeight > 0 ? value / totalWeight : 0,
            color: getClusterColor(cluster)
        }))
        .sort((a, b) => b.value - a.value || a.cluster.localeCompare(b.cluster));
}

function getScienceRingIconId(clusterShares) {
    if (!clusterShares.length) {
        return 'science-ring-neutral';
    }

    return `science-ring-${clusterShares
        .map(({ cluster, share }) => {
            const clusterKey = cluster
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');
            return `${clusterKey || 'cluster'}-${Math.round(share * 100)}`;
        })
        .join('_')}`;
}

function registerScienceRingIcon(iconId, clusterShares) {
    if (!globe || globe.hasImage(iconId)) return;

    const canvas = document.createElement('canvas');
    canvas.width = SCIENCE_RING_IMAGE_SIZE;
    canvas.height = SCIENCE_RING_IMAGE_SIZE;
    const context = canvas.getContext('2d');
    const center = SCIENCE_RING_IMAGE_SIZE / 2;
    const segments = clusterShares.length
        ? clusterShares
        : [{ share: 1, color: SCIENCE_NEUTRAL_COLOR }];

    context.clearRect(0, 0, SCIENCE_RING_IMAGE_SIZE, SCIENCE_RING_IMAGE_SIZE);
    context.lineWidth = SCIENCE_RING_WIDTH;
    context.lineCap = 'butt';
    context.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    context.beginPath();
    context.arc(center, center, SCIENCE_RING_RADIUS, 0, Math.PI * 2);
    context.stroke();

    let startAngle = -Math.PI / 2;
    segments.forEach(segment => {
        const endAngle = startAngle + (Math.PI * 2 * segment.share);
        context.strokeStyle = segment.color || SCIENCE_NEUTRAL_COLOR;
        context.beginPath();
        context.arc(center, center, SCIENCE_RING_RADIUS, startAngle, endAngle);
        context.stroke();
        startAngle = endAngle;
    });

    globe.addImage(iconId, context.getImageData(0, 0, SCIENCE_RING_IMAGE_SIZE, SCIENCE_RING_IMAGE_SIZE));
}

function prepareScienceRingIcons(features) {
    features.forEach(feature => {
        const properties = feature.properties || {};
        registerScienceRingIcon(properties.scienceRingIcon, properties.scienceRingShares || []);
    });
}

function groupScienceRecords(records, countryData) {
    groupedScienceLookup = new Map();

    records.forEach(record => {
        const longitude = Number.isFinite(record.displayLongitude) ? record.displayLongitude : record.longitude;
        const latitude = Number.isFinite(record.displayLatitude) ? record.displayLatitude : record.latitude;
        if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return;
        const groupKey = record.country
            ? `country:${record.country}`
            : `point:${longitude.toFixed(5)},${latitude.toFixed(5)}`;
        const existingGroup = groupedScienceLookup.get(groupKey);

        if (existingGroup) {
            existingGroup.records.push(record);
            existingGroup.longitudeSum += longitude;
            existingGroup.latitudeSum += latitude;
            return;
        }

        groupedScienceLookup.set(groupKey, {
            groupKey,
            records: [record],
            longitudeSum: longitude,
            latitudeSum: latitude
        });
    });

    const maxCount = Math.max(1, ...Array.from(groupedScienceLookup.values()).map(group => getUniquePublicationIds(group.records).size));
    const selectedClusters = getSelectedClusters();

    return Array.from(groupedScienceLookup.values()).map(group => {
        const publicationIds = getUniquePublicationIds(group.records);
        const firstRecord = group.records[0];
        const scienceCount = publicationIds.size;
        const countryMetric = countryData[firstRecord.country]?.value || scienceCount;
        const radius = getScienceCircleRadius(scienceCount, maxCount);
        const topicClustersForGroup = Array.from(new Set(group.records.flatMap(record => record.topicClusters || []))).sort();
        const scienceColor = getScienceClusterColor(topicClustersForGroup, selectedClusters);
        const scienceRingShares = getScienceClusterShares(group.records, selectedClusters);
        const scienceRingIcon = getScienceRingIconId(scienceRingShares);

        return {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [
                    group.longitudeSum / group.records.length,
                    group.latitudeSum / group.records.length
                ]
            },
            properties: {
                groupKey: group.groupKey,
                label: firstRecord.country || firstRecord.region || firstRecord.city || 'Study area',
                country: firstRecord.country || 'Other',
                continent: firstRecord.continent || 'Other',
                scienceCount,
                countryMetric,
                radius,
                scienceColor,
                scienceCoreColor: SCIENCE_NEUTRAL_CORE_COLOR,
                scienceStrokeColor: SCIENCE_NEUTRAL_STROKE_COLOR,
                scienceRingIcon,
                scienceRingIconSize: ((radius * 2) + 12) / SCIENCE_RING_VISIBLE_DIAMETER,
                scienceRingShares,
                strokeWidth: selectedScienceGroupKey === group.groupKey ? SCIENCE_SELECTED_STROKE_WIDTH : SCIENCE_DEFAULT_STROKE_WIDTH,
                selected: selectedScienceGroupKey === group.groupKey,
                topicClusters: topicClustersForGroup.join(', ')
            }
        };
    });
}

function enrichMetricValues(features, countryData) {
    const maxValue = Math.max(1, ...Object.values(countryData).map(item => item.value || 0));

    return features.map(feature => {
        const country = feature.properties.country;
        const countryMetric = countryData[country]?.value || 0;
        const normalizedRadius = 4 + ((countryMetric / maxValue) * 14);
        return {
            ...feature,
            properties: {
                ...feature.properties,
                countryMetric,
                globeRadius: normalizedRadius
            }
        };
    });
}

function getPointKey(feature) {
    const [lng, lat] = feature.geometry.coordinates;
    return `${lng.toFixed(5)},${lat.toFixed(5)}`;
}

function groupFeaturesByPoint(features) {
    groupedFeatureLookup = new Map();

    features.forEach(feature => {
        const groupKey = getPointKey(feature);
        const existingGroup = groupedFeatureLookup.get(groupKey);

        if (existingGroup) {
            existingGroup.features.push(feature);
            existingGroup.maxRadius = Math.max(existingGroup.maxRadius, feature.properties.globeRadius || 4);
            return;
        }

        groupedFeatureLookup.set(groupKey, {
            groupKey,
            coordinates: feature.geometry.coordinates.slice(),
            maxRadius: feature.properties.globeRadius || 4,
            features: [feature]
        });
    });

    return Array.from(groupedFeatureLookup.values()).map(group => {
        const representative = group.features[0];
        const artworkCount = group.features.length;
        const pointRadius = 4;
        const glowRadius = artworkCount > 1
            ? Math.max(group.maxRadius, pointRadius + 10 + Math.min(16, Math.log2(artworkCount) * 5))
            : Math.max(group.maxRadius, pointRadius + 7);

        return {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: group.coordinates
            },
            properties: {
                ...representative.properties,
                groupKey: group.groupKey,
                artworkCount,
                pointRadius,
                glowRadius
            }
        };
    });
}

function renderRanking(containerId, items) {
    const container = document.getElementById(containerId);
    const sorted = Object.values(items)
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);

    if (sorted.length === 0) {
        container.innerHTML = '<div class="text-sm opacity-70">No matching data.</div>';
        return;
    }

    const maxValue = Math.max(1, ...sorted.map(item => item.value || 0));
    container.innerHTML = sorted.map(item => {
        const width = Math.max(3, (item.value / maxValue) * 100);
        const value = Number.isFinite(item.artCount) && Number.isFinite(item.scienceCount)
            ? `Art ${item.artCount} / Sci ${item.scienceCount}`
            : getMetricMode() === 'perCapita' ? item.value.toFixed(3) : item.value.toFixed(0);
        return `
            <div class="globe-ranking-row">
                <div class="flex justify-between gap-3 text-sm">
                    <span class="truncate">${item.label}</span>
                    <span class="font-semibold">${value}</span>
                </div>
                <div class="globe-ranking-track">
                    <div class="globe-ranking-bar" style="width: ${width}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

function getCountryRankingData(countryData) {
    if (getMetricMode() !== 'perCapita') return countryData;

    return Object.fromEntries(
        Object.entries(countryData).filter(([, item]) => !EcoData.isSmallPopulationBase(item.population))
    );
}

function mergeCountryData(artCountryData, scienceCountryData) {
    const countries = new Set([...Object.keys(artCountryData), ...Object.keys(scienceCountryData)]);
    return Object.fromEntries(Array.from(countries).map(country => {
        const artCount = artCountryData[country]?.count || 0;
        const scienceCount = scienceCountryData[country]?.count || 0;
        const population = countryPopulation[country] || 0;
        const count = artCount + scienceCount;
        return [country, {
            label: country,
            count,
            artCount,
            scienceCount,
            population,
            value: normalizeValue(count, population)
        }];
    }));
}

function mergeContinentData(artContinentData, scienceContinentData) {
    const continents = new Set([...Object.keys(artContinentData), ...Object.keys(scienceContinentData)]);
    return Object.fromEntries(Array.from(continents).map(continent => {
        const artCount = artContinentData[continent]?.count || 0;
        const scienceCount = scienceContinentData[continent]?.count || 0;
        const count = artCount + scienceCount;
        return [continent, {
            label: continent,
            count,
            artCount,
            scienceCount,
            value: count
        }];
    }));
}

function setLayerVisibility(layerIds, visible) {
    layerIds.forEach(layerId => {
        if (globe.getLayer(layerId)) {
            globe.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
        }
    });
}

function renderInlineClusterBreakdown(items) {
    return items.map(item => `
        <div class="globe-breakdown-row">
            <span class="globe-legend-swatch" style="--legend-color: ${escapeHtml(item.color || SCIENCE_NEUTRAL_COLOR)}"></span>
            <span>${escapeHtml(item.cluster || item.topic)}</span>
            <strong>${item.count}</strong>
        </div>
    `).join('');
}

function updateScienceStatus(filteredArtworks, filteredPlaceableRecords, filteredNonPlaceableRecords, filteredGlobalRecords) {
    const status = document.getElementById('globeScienceStatus');
    if (!status) return;

    const mode = getMapMode();
    const scienceModeActive = mode === 'science' || mode === 'both';
    const artModeActive = mode === 'art' || mode === 'both';
    const scienceCount = getUniquePublicationCount([
        ...filteredPlaceableRecords,
        ...filteredNonPlaceableRecords,
        ...filteredGlobalRecords
    ]);
    const hasAnyScienceExport = scienceMapData && (
        scienceRecords.length > 0 ||
        nonPlaceableScienceRecords.length > 0 ||
        globalScienceRecords.length > 0
    );

    if (!scienceModeActive) {
        if (artModeActive && filteredArtworks.length === 0) {
            status.textContent = 'No artworks match these filters.';
            status.classList.remove('hidden');
            return;
        }

        status.classList.add('hidden');
        status.textContent = '';
        return;
    }

    if (!scienceMapData || !hasAnyScienceExport) {
        status.textContent = 'Science data not available yet. Art data remains fully available.';
        status.classList.remove('hidden');
        return;
    }

    const notes = [];
    if (scienceCount === 0) {
        notes.push('No research publications match these filters.');
    }
    if (artModeActive && filteredArtworks.length === 0) {
        notes.push('No artworks match these filters.');
    }
    if (filteredNonPlaceableRecords.length > 0) {
        notes.push(`${getUniquePublicationCount(filteredNonPlaceableRecords)} publication(s) match the filters but have no safe map coordinates yet.`);
    }
    if (filteredGlobalRecords.length > 0) {
        notes.push(`${getUniquePublicationCount(filteredGlobalRecords)} global publication(s) are kept out of the point layer.`);
    }

    if (notes.length === 0) {
        status.classList.add('hidden');
        status.textContent = '';
        return;
    }

    status.textContent = notes.join(' ');
    status.classList.remove('hidden');
}

function renderGlobalScienceSummary(filteredGlobalRecords) {
    const container = document.getElementById('globeGlobalScienceSummary');
    if (!container) return;

    const mode = getMapMode();
    const globalCount = getUniquePublicationCount(filteredGlobalRecords);

    if (!(mode === 'science' || mode === 'both') || globalCount === 0) {
        container.classList.add('hidden');
        container.innerHTML = '';
        return;
    }

    const clusterBreakdown = getScienceClusterBreakdown(filteredGlobalRecords);
    container.innerHTML = `
        <h2 class="globe-card-title">Global research</h2>
        <div class="globe-card-value">${globalCount} publication${globalCount === 1 ? '' : 's'}</div>
        <div class="globe-card-subtle">Kept outside the geographic point layer.</div>
        <div class="globe-breakdown mt-3">${renderInlineClusterBreakdown(clusterBreakdown)}</div>
    `;
    container.classList.remove('hidden');
}

function renderMapLegend(displayScienceFeatures = []) {
    const container = document.getElementById('globeLegend');
    if (!container) return;

    const mode = getMapMode();
    const selectedClusters = getSelectedClusters();
    const scienceActive = mode === 'science' || mode === 'both';
    const artActive = mode === 'art' || mode === 'both';
    const selectedClusterText = selectedClusters.length === 1
        ? `${selectedClusters[0]} color`
        : selectedClusters.length > 1
            ? 'neutral color for mixed selected clusters'
            : 'topic color when one cluster is represented, neutral when mixed';
    const maxScienceCount = Math.max(0, ...displayScienceFeatures.map(feature => feature.properties.scienceCount || 0));

    const artLegend = artActive ? `
        <div class="globe-legend-row">
            <span class="globe-legend-art-marker"></span>
            <span>Artwork marker: one cultural object; color = topic cluster.</span>
        </div>
    ` : '';
    const scienceLegend = scienceActive ? `
        <div class="globe-legend-row">
            <span class="globe-legend-science-circle"></span>
            <span>Research circle: country-level activity; size = unique matching publications.</span>
        </div>
        <div class="globe-legend-row">
            <span class="globe-legend-science-ring"></span>
            <span>Outer ring: fractional topic-cluster mix of matching publications.</span>
        </div>
        <div class="globe-card-subtle">Inner color stays neutral; ${escapeHtml(selectedClusterText)} appears in the ring.</div>
        <div class="globe-card-subtle">Circle scale uses sqrt(count), bounded ${SCIENCE_CIRCLE_MIN_RADIUS}-${SCIENCE_CIRCLE_MAX_RADIUS}px${maxScienceCount ? `; current max ${maxScienceCount}.` : '.'}</div>
    ` : '';

    container.innerHTML = `
        <h2 class="globe-card-title">Legend</h2>
        <div class="globe-legend">${artLegend}${scienceLegend}</div>
    `;
}

function updateGlobe() {
    const mode = getMapMode();
    if (mode === 'science' && activeArtworkPopup) {
        activeArtworkPopup.remove();
        activeArtworkPopup = null;
    }
    if (mode === 'art' && activeSciencePopup) {
        activeSciencePopup.remove();
        activeSciencePopup = null;
        selectedScienceGroupKey = null;
    }

    const filtered = getFilteredFeatures();
    const countryData = aggregateByCountry(filtered);
    const continentData = aggregateByContinent(filtered);
    const filteredScience = getFilteredScienceRecords(scienceRecords);
    const filteredNonPlaceableScience = getFilteredScienceRecords(nonPlaceableScienceRecords);
    const filteredGlobalScience = getFilteredScienceRecords(globalScienceRecords);
    const scienceCountryData = aggregateScienceByCountry([
        ...filteredScience,
        ...filteredNonPlaceableScience
    ]);
    const scienceContinentData = aggregateScienceByContinent([
        ...filteredScience,
        ...filteredNonPlaceableScience
    ]);
    const rankingCountryData = mode === 'science'
        ? scienceCountryData
        : mode === 'both'
            ? mergeCountryData(countryData, scienceCountryData)
            : countryData;
    const rankingContinentData = mode === 'science'
        ? scienceContinentData
        : mode === 'both'
            ? mergeContinentData(continentData, scienceContinentData)
            : continentData;
    const countryRankingData = getCountryRankingData(rankingCountryData);
    const displayFeatures = groupFeaturesByPoint(enrichMetricValues(filtered, countryData));
    const displayScienceFeatures = groupScienceRecords(filteredScience, scienceCountryData);

    document.getElementById('globeArtworkCount').textContent = mode === 'science' ? 0 : filtered.length;
    const visibleScienceCount = getUniquePublicationCount([
        ...filteredScience,
        ...filteredNonPlaceableScience,
        ...filteredGlobalScience
    ]);
    document.getElementById('globeScienceCount').textContent = mode === 'art' ? 0 : visibleScienceCount;
    document.getElementById('globeCountryCount').textContent = Object.keys(rankingCountryData).length;
    renderRanking('globeCountryRanking', countryRankingData);
    renderRanking('globeContinentRanking', rankingContinentData);
    updateScienceStatus(filtered, filteredScience, filteredNonPlaceableScience, filteredGlobalScience);
    renderMapLegend(displayScienceFeatures);
    renderGlobalScienceSummary(filteredGlobalScience);

    const source = globe.getSource('globeArtworks');
    if (source) {
        source.setData({
            type: 'FeatureCollection',
            features: displayFeatures
        });
    }

    const scienceSource = globe.getSource('globeScience');
    if (scienceSource) {
        prepareScienceRingIcons(displayScienceFeatures);
        scienceSource.setData({
            type: 'FeatureCollection',
            features: displayScienceFeatures
        });
    }

    setLayerVisibility(['globe-artwork-halo', 'globe-artwork-point', 'globe-artwork-count'], mode === 'art' || mode === 'both');
    setLayerVisibility(['globe-science-area', 'globe-science-ring', 'globe-science-core'], mode === 'science' || mode === 'both');
    setLayerVisibility(['globe-science-count'], false);
}

function populateClusterFilter() {
    const select = document.getElementById('globeCluster');
    Object.entries(topicClusters)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([cluster, data]) => {
            const option = new Option(cluster, cluster);
            option.style.color = data.color;
            select.add(option);
        });
}

function populatePlaceFilters() {
    const continentSelect = document.getElementById('globeContinent');
    const countrySelect = document.getElementById('globeCountry');
    const continents = Array.from(new Set(Object.values(continentMapping))).sort();
    const countries = Object.keys(continentMapping).sort();

    continents.forEach(continent => {
        continentSelect.add(new Option(continent, continent));
    });

    countries.forEach(country => {
        const option = new Option(country, country);
        option.dataset.continent = continentMapping[country] || 'Other';
        countrySelect.add(option);
    });
}

function refreshCountryOptions() {
    const continent = document.getElementById('globeContinent').value;
    const countrySelect = document.getElementById('globeCountry');

    Array.from(countrySelect.options).forEach(option => {
        if (!option.value) {
            option.hidden = false;
            return;
        }
        const visible = !continent || option.dataset.continent === continent;
        option.hidden = !visible;
        if (!visible && option.selected) {
            option.selected = false;
        }
    });
}

function attachEvents() {
    ['globeSearch', 'globeCountry', 'globeYearFrom', 'globeYearTo'].forEach(id => {
        document.getElementById(id).addEventListener('input', updateGlobe);
        document.getElementById(id).addEventListener('change', updateGlobe);
    });

    document.getElementById('globeCluster').addEventListener('change', event => {
        const select = event.target;
        const selectedValues = Array.from(select.selectedOptions).map(option => option.value);
        const allOption = select.querySelector('option[value=""]');

        if (selectedValues.length > 1 && selectedValues.includes('')) {
            allOption.selected = false;
        }
        if (Array.from(select.selectedOptions).length === 0) {
            allOption.selected = true;
        }

        updateGlobe();
    });

    document.getElementById('globeContinent').addEventListener('change', () => {
        refreshCountryOptions();
        updateGlobe();
    });

    document.querySelectorAll('input[name="exploreView"]').forEach(input => {
        input.addEventListener('change', event => {
            const projection = event.target.value === 'map' ? 'mercator' : 'globe';
            globe.setProjection(projection);
        });
    });

    document.querySelectorAll('input[name="globeMetric"]').forEach(input => {
        input.addEventListener('change', updateGlobe);
    });

    document.querySelectorAll('input[name="globeMode"]').forEach(input => {
        input.addEventListener('change', updateGlobe);
    });

    document.getElementById('resetGlobeFilters').addEventListener('click', () => {
        document.getElementById('globeSearch').value = '';
        resetClusterFilter();
        document.getElementById('globeContinent').value = '';
        document.getElementById('globeCountry').value = '';
        document.getElementById('globeYearFrom').value = '';
        document.getElementById('globeYearTo').value = '';
        document.querySelector('input[name="globeMetric"][value="total"]').checked = true;
        document.querySelector('input[name="globeMode"][value="art"]').checked = true;
        const globeView = document.querySelector('input[name="exploreView"][value="globe"]');
        if (globeView) {
            globeView.checked = true;
            globe.setProjection('globe');
        }
        refreshCountryOptions();
        updateGlobe();
    });
}

function addGlobeLayers() {
    globe.addSource('globeScience', {
        type: 'geojson',
        data: {
            type: 'FeatureCollection',
            features: []
        }
    });

    globe.addLayer({
        id: 'globe-science-area',
        type: 'circle',
        source: 'globeScience',
        layout: {
            visibility: 'none'
        },
        paint: {
            'circle-color': ['get', 'scienceColor'],
            'circle-radius': ['get', 'radius'],
            'circle-opacity': 0.24,
            'circle-stroke-width': ['get', 'strokeWidth'],
            'circle-stroke-color': ['get', 'scienceStrokeColor'],
            'circle-stroke-opacity': 0.9
        }
    });

    globe.addLayer({
        id: 'globe-science-core',
        type: 'circle',
        source: 'globeScience',
        layout: {
            visibility: 'none'
        },
        paint: {
            'circle-color': ['get', 'scienceCoreColor'],
            'circle-radius': 5,
            'circle-opacity': 0.95,
            'circle-stroke-width': 1,
            'circle-stroke-color': '#ecfeff'
        }
    });

    globe.addLayer({
        id: 'globe-science-ring',
        type: 'symbol',
        source: 'globeScience',
        layout: {
            visibility: 'none',
            'icon-image': ['get', 'scienceRingIcon'],
            'icon-size': ['get', 'scienceRingIconSize'],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'icon-pitch-alignment': 'viewport',
            'icon-rotation-alignment': 'viewport'
        }
    });

    globe.addLayer({
        id: 'globe-science-count',
        type: 'symbol',
        source: 'globeScience',
        layout: {
            visibility: 'none',
            'text-field': ['to-string', ['get', 'scienceCount']],
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size': 10,
            'text-allow-overlap': true
        },
        paint: {
            'text-color': '#ffffff'
        }
    });

    globe.addSource('globeArtworks', {
        type: 'geojson',
        data: {
            type: 'FeatureCollection',
            features: []
        }
    });

    globe.addLayer({
        id: 'globe-artwork-halo',
        type: 'circle',
        source: 'globeArtworks',
        paint: {
            'circle-color': ['get', 'mainClusterColor'],
            'circle-radius': ['get', 'glowRadius'],
            'circle-opacity': [
                'interpolate',
                ['linear'],
                ['get', 'artworkCount'],
                1,
                0.11,
                4,
                0.34,
                10,
                0.58
            ],
            'circle-blur': [
                'interpolate',
                ['linear'],
                ['get', 'artworkCount'],
                1,
                0.95,
                4,
                0.72,
                10,
                0.48
            ]
        }
    });

    globe.addLayer({
        id: 'globe-artwork-point',
        type: 'circle',
        source: 'globeArtworks',
        paint: {
            'circle-color': ['get', 'mainClusterColor'],
            'circle-radius': ['get', 'pointRadius'],
            'circle-opacity': [
                'case',
                ['>', ['get', 'artworkCount'], 1],
                0.98,
                0.82
            ],
            'circle-stroke-width': 1,
            'circle-stroke-color': '#ffffff'
        }
    });

    globe.addLayer({
        id: 'globe-artwork-count',
        type: 'symbol',
        source: 'globeArtworks',
        filter: ['>', ['get', 'artworkCount'], 1],
        layout: {
            'text-field': ['to-string', ['get', 'artworkCount']],
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size': 9,
            'text-allow-overlap': true
        },
        paint: {
            'text-color': '#ffffff'
        }
    });

    ['globe-artwork-point', 'globe-artwork-count'].forEach(layerId => {
        globe.on('mouseenter', layerId, () => {
            globe.getCanvas().style.cursor = 'pointer';
        });

        globe.on('mouseleave', layerId, () => {
            globe.getCanvas().style.cursor = '';
        });
    });

    ['globe-science-area', 'globe-science-ring', 'globe-science-core', 'globe-science-count'].forEach(layerId => {
        globe.on('mouseenter', layerId, () => {
            globe.getCanvas().style.cursor = 'pointer';
        });

        globe.on('mouseleave', layerId, () => {
            globe.getCanvas().style.cursor = '';
        });
    });

    function getSortedGroupFeatures(group) {
        return group.features
            .slice()
            .sort((a, b) => {
                const yearA = parseYear(a.properties?.year) ?? 9999;
                const yearB = parseYear(b.properties?.year) ?? 9999;
                if (yearA !== yearB) return yearA - yearB;
                return (a.properties?.title || '').localeCompare(b.properties?.title || '');
            });
    }

    function renderArtworkCard(feature) {
        const props = feature.properties || {};
        const thumbnailHtml = getThumbnailHtml(props.thumbnail, 'globe-popup-thumbnail');
        const cardClass = thumbnailHtml
            ? 'globe-popup-carousel-card'
            : 'globe-popup-carousel-card globe-popup-carousel-card--no-thumbnail';
        const descriptionExcerpt = getDescriptionExcerpt(props.description, 130);
        const descriptionHtml = descriptionExcerpt
            ? `<p class="globe-popup-item-description">${escapeHtml(descriptionExcerpt)}</p>`
            : '';
        const artistText = props.year ? `${props.artist || 'Unknown'}, ${props.year}` : (props.artist || 'Unknown');
        const locationText = props.location || 'Unknown';
        const clusterText = props.mainCluster || 'Uncategorized';
        const artformText = getPrimaryArtform(props);
        const artformHtml = artformText
            ? `<div class="globe-popup-artform"><strong>Type:</strong> ${escapeHtml(artformText)}</div>`
            : '';
        const moreInfoUrl = getValidUrl(props.url);
        const moreInfoHtml = moreInfoUrl
            ? `<a class="globe-popup-link" href="${escapeHtml(moreInfoUrl)}" target="_blank" rel="noopener noreferrer">More information</a>`
            : '';

        return `
            <article class="${cardClass}">
                ${thumbnailHtml}
                <div class="globe-popup-item-body">
                    <h3>${escapeHtml(props.title || 'Untitled')}</h3>
                    <div class="globe-popup-primary-meta">${escapeHtml(artistText)}</div>
                    <div class="globe-popup-location">${escapeHtml(locationText)}</div>
                    ${artformHtml}
                    <div class="globe-popup-card-cluster">${renderClusterChip(clusterText)}</div>
                    ${descriptionHtml}
                    ${moreInfoHtml}
                </div>
            </article>
        `;
    }

    function renderClusterChip(cluster) {
        const color = getClusterColor(cluster);
        return `
            <span class="globe-popup-cluster-chip" style="--cluster-color: ${escapeHtml(color)}">
                <span aria-hidden="true"></span>
                ${escapeHtml(cluster)}
            </span>
        `;
    }

    function renderSingleArtworkPopup(feature) {
        const props = feature.properties || {};
        const thumbnailHtml = getThumbnailHtml(props.thumbnail);
        const descriptionExcerpt = getDescriptionExcerpt(props.description);
        const descriptionHtml = descriptionExcerpt
            ? `<p class="globe-popup-description">${escapeHtml(descriptionExcerpt)}</p>`
            : '';
        const artistText = props.year ? `${props.artist || 'Unknown'}, ${props.year}` : (props.artist || 'Unknown');
        const artformText = getPrimaryArtform(props);
        const artformHtml = artformText
            ? `<div class="globe-popup-artform"><strong>Type:</strong> ${escapeHtml(artformText)}</div>`
            : '';
        const moreInfoUrl = getValidUrl(props.url);
        const moreInfoHtml = moreInfoUrl
            ? `<a class="globe-popup-link" href="${escapeHtml(moreInfoUrl)}" target="_blank" rel="noopener noreferrer">More information</a>`
            : '';

        return `
            <div class="globe-popup">
                ${thumbnailHtml}
                <h3>${escapeHtml(props.title || 'Untitled')}</h3>
                <div class="globe-popup-primary-meta">${escapeHtml(artistText)}</div>
                <div class="globe-popup-location">${escapeHtml(props.location || 'Unknown')}</div>
                ${artformHtml}
                ${descriptionHtml}
                <div class="globe-popup-meta">
                    <p><strong>Cluster:</strong> ${escapeHtml(props.mainCluster || 'Uncategorized')}</p>
                </div>
                ${moreInfoHtml}
            </div>
        `;
    }

    function renderGroupPopup(group, activeIndex = 0) {
        const sortedFeatures = getSortedGroupFeatures(group);
        const location = sortedFeatures[0]?.properties?.location || 'Shared location';
        const safeIndex = ((activeIndex % sortedFeatures.length) + sortedFeatures.length) % sortedFeatures.length;
        const activeFeature = sortedFeatures[safeIndex];

        return `
            <div class="globe-popup globe-popup-group">
                <div class="globe-popup-group-header">
                    <h3>${sortedFeatures.length} artworks at this point</h3>
                    <div class="globe-popup-location">${escapeHtml(location)}</div>
                </div>
                <div class="globe-popup-carousel">
                    ${renderArtworkCard(activeFeature)}
                    <div class="globe-popup-carousel-controls">
                        <button type="button" class="globe-popup-carousel-button" data-carousel-step="-1" aria-label="Previous artwork">&lt;</button>
                        <span class="globe-popup-carousel-count">${safeIndex + 1} / ${sortedFeatures.length}</span>
                        <button type="button" class="globe-popup-carousel-button" data-carousel-step="1" aria-label="Next artwork">&gt;</button>
                    </div>
                </div>
            </div>
        `;
    }

    function renderSciencePopup(group) {
        const publicationIds = getUniquePublicationIds(group.records);
        const firstRecord = group.records[0] || {};
        const clusterBreakdown = getScienceClusterBreakdown(group.records);
        const years = group.records
            .map(record => parseYear(record.year))
            .filter(year => year !== null)
            .sort((a, b) => a - b);
        const yearText = years.length > 0
            ? `${years[0]}-${years[years.length - 1]}`
            : 'Year unknown';
        const clusterHtml = clusterBreakdown.length > 0
            ? renderInlineClusterBreakdown(clusterBreakdown)
            : '<div class="globe-card-subtle">No classified topic cluster yet.</div>';

        return `
            <div class="globe-popup globe-popup-science">
                <h3>${escapeHtml(firstRecord.country || firstRecord.region || firstRecord.city || 'Study area')}</h3>
                <div class="globe-popup-primary-meta">${publicationIds.size} publication${publicationIds.size === 1 ? '' : 's'}</div>
                <div class="globe-popup-location">${escapeHtml(yearText)}</div>
                <div class="globe-popup-meta">
                    <p><strong>Scope:</strong> ${escapeHtml(firstRecord.geographicScope || 'unknown')}</p>
                    <p><strong>Geometry:</strong> ${firstRecord.hasStudyCoordinates ? 'study-area coordinates' : 'country display anchor'}</p>
                </div>
                <div class="globe-popup-section">
                    <strong>Cluster breakdown</strong>
                    <div class="globe-breakdown">${clusterHtml}</div>
                </div>
            </div>
        `;
    }

    function openArtworkPopup(event) {
        const feature = event.features[0];
        const props = feature.properties || {};
        const group = groupedFeatureLookup.get(props.groupKey);
        const coordinates = feature.geometry.coordinates.slice();
        activeArtworkPopup?.remove();
        const popup = new mapboxgl.Popup({ maxWidth: '360px' })
            .setLngLat(coordinates)
            .addTo(globe);
        activeArtworkPopup = popup;
        popup.on('close', () => {
            if (activeArtworkPopup === popup) {
                activeArtworkPopup = null;
            }
        });

        if (!group || group.features.length <= 1) {
            popup.setHTML(renderSingleArtworkPopup(group?.features[0] || feature));
            return;
        }

        let activeIndex = 0;

        function renderCarousel() {
            popup.setHTML(renderGroupPopup(group, activeIndex));
            const popupElement = popup.getElement();
            popupElement.querySelectorAll('[data-carousel-step]').forEach(button => {
                button.addEventListener('click', () => {
                    activeIndex += Number(button.dataset.carouselStep || 0);
                    renderCarousel();
                });
            });
        }

        renderCarousel();
    }

    function openSciencePopup(event) {
        const feature = event.features[0];
        const props = feature.properties || {};
        const group = groupedScienceLookup.get(props.groupKey);
        if (!group) return;

        selectedScienceGroupKey = props.groupKey;
        updateGlobe();
        activeSciencePopup?.remove();
        const popup = new mapboxgl.Popup({ maxWidth: '320px' })
            .setLngLat(feature.geometry.coordinates.slice())
            .setHTML(renderSciencePopup(group))
            .addTo(globe);
        activeSciencePopup = popup;
        popup.on('close', () => {
            if (activeSciencePopup === popup) {
                activeSciencePopup = null;
                selectedScienceGroupKey = null;
                updateGlobe();
            }
        });
    }

    globe.on('click', 'globe-artwork-point', openArtworkPopup);
    globe.on('click', 'globe-artwork-count', openArtworkPopup);
    globe.on('click', 'globe-science-area', openSciencePopup);
    globe.on('click', 'globe-science-ring', openSciencePopup);
    globe.on('click', 'globe-science-core', openSciencePopup);
    globe.on('click', 'globe-science-count', openSciencePopup);
}

async function loadGlobeData() {
    ({ artworkData, topicClusters, continentMapping, countryPopulation } = await loadSharedData());
    scienceMapData = await loadScienceMapData();
    enrichedFeatures = (artworkData.features || []).map(enrichFeature);
    scienceRecords = (scienceMapData?.records || []).map(normalizeScienceRecord);
    nonPlaceableScienceRecords = (scienceMapData?.nonPlaceableRecords || []).map(normalizeScienceRecord);
    globalScienceRecords = (scienceMapData?.globalRecords || []).map(normalizeScienceRecord);

    populateClusterFilter();
    populatePlaceFilters();
    refreshCountryOptions();
    attachEvents();
    updateGlobe();
}

globe.on('style.load', () => {
    globe.setFog({
        color: 'rgb(22, 32, 45)',
        'high-color': 'rgb(36, 92, 96)',
        'horizon-blend': 0.18,
        'space-color': 'rgb(7, 10, 18)',
        'star-intensity': 0.35
    });
});

globe.on('load', () => {
    addGlobeLayers();
    loadGlobeData().catch(error => {
        document.getElementById('globeCountryRanking').innerHTML = `<div class="alert alert-error">Could not load globe data: ${error.message}</div>`;
    });
});
