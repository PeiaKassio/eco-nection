const EcoData = (() => {
    const DATA_VERSION = '20260922-science-map-modes';
    const DATA_PATHS = {
        artworkData: 'data/artwork-data.json',
        topicClusters: 'data/topicClusters.json',
        continentMapping: 'data/continentMapping.json',
        countryPopulation: 'data/countryPopulation.json',
        scienceMap: 'data/science/exports/science-map.json'
    };

    const MIN_POPULATION_FOR_COUNTRY_PER_CAPITA = 1000000;

    const COUNTRY_ALIASES = {
        "DRC (Africa leg)": "Democratic Republic of the Congo",
        "Dead Sea region (Israel/Jordan Rift)": "Israel",
        "Dead Sea region (Jordan/Israel)": "Israel",
        "Tropical regions": "Other",
        "Various exhibitions": "Other",
        "United States Minor Outlying Islands": "Other"
    };

    async function fetchJson(path, label) {
        const separator = path.includes('?') ? '&' : '?';
        const response = await fetch(`${path}${separator}v=${DATA_VERSION}`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Failed to load ${label}`);
        return response.json();
    }

    async function loadSharedData() {
        const [artworkData, topicClusters, continentMapping, countryPopulation] = await Promise.all([
            fetchJson(DATA_PATHS.artworkData, 'artwork-data.json'),
            fetchJson(DATA_PATHS.topicClusters, 'topicClusters.json'),
            fetchJson(DATA_PATHS.continentMapping, 'continentMapping.json'),
            fetchJson(DATA_PATHS.countryPopulation, 'countryPopulation.json')
        ]);

        return {
            artworkData: getPublishedArtworkData(artworkData),
            topicClusters,
            continentMapping,
            countryPopulation
        };
    }

    async function loadScienceMapData() {
        try {
            const scienceMap = await fetchJson(DATA_PATHS.scienceMap, 'science-map.json');
            return {
                schemaVersion: scienceMap.schemaVersion || 'science-map-v1',
                generatedAt: scienceMap.generatedAt || null,
                records: Array.isArray(scienceMap.records) ? scienceMap.records : [],
                nonPlaceableRecords: Array.isArray(scienceMap.nonPlaceableRecords) ? scienceMap.nonPlaceableRecords : [],
                globalRecords: Array.isArray(scienceMap.globalRecords) ? scienceMap.globalRecords : [],
                warnings: Array.isArray(scienceMap.warnings) ? scienceMap.warnings : []
            };
        } catch (error) {
            console.warn('Science map export unavailable:', error.message);
            return null;
        }
    }

    function isPublishedArtwork(artwork) {
        return artwork?.properties?.review?.status !== 'needs_review';
    }

    function getPublishedArtworkData(artworkData) {
        return {
            ...artworkData,
            features: (artworkData.features || []).filter(isPublishedArtwork)
        };
    }

    function normalizeText(value) {
        return (value || '')
            .toString()
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .toLowerCase();
    }

    function getCountryFromLocation(location, continentMapping = {}, countryPopulation = {}) {
        const rawLocation = (location || '').trim();
        if (COUNTRY_ALIASES[rawLocation]) return COUNTRY_ALIASES[rawLocation];
        if (continentMapping[rawLocation] || countryPopulation[rawLocation]) return rawLocation;

        const lastPart = rawLocation.split(',').pop().trim();
        return COUNTRY_ALIASES[lastPart] || lastPart || 'Other';
    }

    function getContinentForCountry(country, continentMapping = {}) {
        return continentMapping[country] || continentMapping[country?.toLowerCase()] || 'Other';
    }

    function getArtworkClusters(artwork, topicClusters = {}) {
        const topics = artwork.properties?.tags?.topic || [];
        return topics
            .map(topic => Object.keys(topicClusters).find(cluster => topicClusters[cluster].topics.includes(topic)))
            .filter(Boolean);
    }

    function getMainCluster(artwork, topicClusters = {}) {
        return getArtworkClusters(artwork, topicClusters)[0] || 'Uncategorized';
    }

    function getClusterColor(cluster, topicClusters = {}) {
        return topicClusters[cluster]?.color || '#9ca3af';
    }

    function getClusterColors(topicClusters = {}) {
        return Object.fromEntries(
            Object.entries(topicClusters).map(([cluster, data]) => [cluster, data.color])
        );
    }

    function parseYear(value) {
        const year = parseInt(value, 10);
        return Number.isNaN(year) ? null : year;
    }

    function normalizePerCapita(count, population, metricMode) {
        if (metricMode !== 'perCapita') return count;
        if (!population || population <= 0) return null;
        return (count / population) * 1000000;
    }

    function isSmallPopulationBase(population) {
        return !population || population < MIN_POPULATION_FOR_COUNTRY_PER_CAPITA;
    }

    function enrichArtwork(artwork, { topicClusters = {}, continentMapping = {}, countryPopulation = {} } = {}) {
        const country = getCountryFromLocation(artwork.properties?.location, continentMapping, countryPopulation);
        const continent = getContinentForCountry(country, continentMapping);
        const clusters = getArtworkClusters(artwork, topicClusters);
        const mainCluster = clusters[0] || 'Uncategorized';

        return {
            ...artwork,
            properties: {
                ...artwork.properties,
                country,
                continent,
                clusters,
                mainCluster,
                mainClusterColor: getClusterColor(mainCluster, topicClusters)
            }
        };
    }

    return {
        COUNTRY_ALIASES,
        MIN_POPULATION_FOR_COUNTRY_PER_CAPITA,
        loadSharedData,
        loadScienceMapData,
        isPublishedArtwork,
        getPublishedArtworkData,
        normalizeText,
        getCountryFromLocation,
        getContinentForCountry,
        getArtworkClusters,
        getMainCluster,
        getClusterColor,
        getClusterColors,
        parseYear,
        normalizePerCapita,
        isSmallPopulationBase,
        enrichArtwork
    };
})();

if (typeof window !== 'undefined') {
    window.EcoData = EcoData;
}
