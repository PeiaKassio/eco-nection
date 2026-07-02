mapboxgl.accessToken = 'pk.eyJ1IjoicGVpc2thc3NpbyIsImEiOiJjbTM4eHB5NHIwd2M5MmlxeGlsOTRqams5In0.hEmqLEzaR2kWC2s7Hgd-Ng';

let artworkData = { type: 'FeatureCollection', features: [] };
let topicClusters = {};
let continentMapping = {};
let countryPopulation = {};
let enrichedFeatures = [];
let groupedFeatureLookup = new Map();
const {
    loadSharedData,
    normalizeText,
    parseYear
} = EcoData;

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

function getFilteredFeatures() {
    const query = normalizeText(document.getElementById('globeSearch').value.trim());
    const cluster = document.getElementById('globeCluster').value;
    const fromYear = parseInt(document.getElementById('globeYearFrom').value, 10);
    const toYear = parseInt(document.getElementById('globeYearTo').value, 10);

    return enrichedFeatures.filter(feature => {
        const props = feature.properties || {};
        const year = parseYear(props.year);
        const text = normalizeText(`${props.title} ${props.artist} ${props.location} ${props.description}`);

        if (!isValidPoint(feature)) return false;
        if (query && !text.includes(query)) return false;
        if (cluster && !(props.clusters || []).includes(cluster)) return false;
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
        const value = getMetricMode() === 'perCapita' ? item.value.toFixed(3) : item.value.toFixed(0);
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

function updateGlobe() {
    const filtered = getFilteredFeatures();
    const countryData = aggregateByCountry(filtered);
    const continentData = aggregateByContinent(filtered);
    const countryRankingData = getCountryRankingData(countryData);
    const displayFeatures = groupFeaturesByPoint(enrichMetricValues(filtered, countryData));

    document.getElementById('globeArtworkCount').textContent = filtered.length;
    document.getElementById('globeCountryCount').textContent = Object.keys(countryData).length;
    renderRanking('globeCountryRanking', countryRankingData);
    renderRanking('globeContinentRanking', continentData);

    const source = globe.getSource('globeArtworks');
    if (source) {
        source.setData({
            type: 'FeatureCollection',
            features: displayFeatures
        });
    }
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

function attachEvents() {
    ['globeSearch', 'globeCluster', 'globeYearFrom', 'globeYearTo'].forEach(id => {
        document.getElementById(id).addEventListener('input', updateGlobe);
        document.getElementById(id).addEventListener('change', updateGlobe);
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

    document.getElementById('resetGlobeFilters').addEventListener('click', () => {
        document.getElementById('globeSearch').value = '';
        document.getElementById('globeCluster').value = '';
        document.getElementById('globeYearFrom').value = '';
        document.getElementById('globeYearTo').value = '';
        document.querySelector('input[name="globeMetric"][value="total"]').checked = true;
        const globeView = document.querySelector('input[name="exploreView"][value="globe"]');
        if (globeView) {
            globeView.checked = true;
            globe.setProjection('globe');
        }
        updateGlobe();
    });
}

function addGlobeLayers() {
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
        const thumbnailHtml = getThumbnailHtml(props.thumbnail, 'globe-popup-item-thumbnail');
        const descriptionExcerpt = getDescriptionExcerpt(props.description, 130);
        const descriptionHtml = descriptionExcerpt
            ? `<p class="globe-popup-item-description">${escapeHtml(descriptionExcerpt)}</p>`
            : '';
        const artistText = props.year ? `${props.artist || 'Unknown'}, ${props.year}` : (props.artist || 'Unknown');
        const moreInfoUrl = getValidUrl(props.url);
        const moreInfoHtml = moreInfoUrl
            ? `<a class="globe-popup-link" href="${escapeHtml(moreInfoUrl)}" target="_blank" rel="noopener noreferrer">More information</a>`
            : '';

        return `
            <article class="globe-popup-carousel-card">
                ${thumbnailHtml}
                <div class="globe-popup-item-body">
                    <h4>${escapeHtml(props.title || 'Untitled')}</h4>
                    <div class="globe-popup-primary-meta">${escapeHtml(artistText)}</div>
                    ${descriptionHtml}
                    ${moreInfoHtml}
                </div>
            </article>
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

    function openArtworkPopup(event) {
        const feature = event.features[0];
        const props = feature.properties || {};
        const group = groupedFeatureLookup.get(props.groupKey);
        const coordinates = feature.geometry.coordinates.slice();
        const popup = new mapboxgl.Popup({ maxWidth: '360px' })
            .setLngLat(coordinates)
            .addTo(globe);

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

    globe.on('click', 'globe-artwork-point', openArtworkPopup);
    globe.on('click', 'globe-artwork-count', openArtworkPopup);
}

async function loadGlobeData() {
    ({ artworkData, topicClusters, continentMapping, countryPopulation } = await loadSharedData());
    enrichedFeatures = (artworkData.features || []).map(enrichFeature);

    populateClusterFilter();
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
