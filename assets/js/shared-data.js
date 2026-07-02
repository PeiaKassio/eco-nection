const EcoData = (() => {
    const DATA_VERSION = '20260702-pages-rebuild';
    const DATA_PATHS = {
        artworkData: 'data/artwork-data.json',
        topicClusters: 'data/topicClusters.json',
        continentMapping: 'data/continentMapping.json',
        countryPopulation: 'data/countryPopulation.json'
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
            artworkData,
            topicClusters,
            continentMapping,
            countryPopulation
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
