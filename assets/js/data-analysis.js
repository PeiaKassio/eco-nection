// Globale Variablen für Daten
let artworks = [];
let topicClusters = {};
let continentMapping = {};

// Filterwerte
let selectedContinent = [];
let selectedCountry = [];
let selectedTopics = [];
let countryOptionsMaster = []; // unveränderte Voll-Liste für die Suche

// Daten laden
async function loadData() {
    try {
        artworks = await fetch('data/artwork-data.json').then(res => res.json());
        topicClusters = await fetch('data/topicClusters.json').then(res => res.json());
        continentMapping = await fetch('data/continentMapping.json').then(res => res.json());

        console.log("JSON files loaded successfully");
        initializeFilters();
        applyFilters();
        updateCharts();
    } catch (error) {
        console.error("Error loading JSON data:", error);
    }
}

// Filter-Initialisierung
function initializeFilters() {
    const continentSelect = document.getElementById('continentSelect');
    const countrySelect = document.getElementById('countrySelect');
    const topicClusterSelect = document.getElementById('topicClusterSelect');
    const countrySearch = document.getElementById('countrySearch');

    continentSelect.add(new Option('All Continents', 'all'));
    countrySelect.add(new Option('All Countries', 'all'));
    topicClusterSelect.add(new Option('All Topic Clusters', 'all'));

    // Kontinente
    let uniqueContinents = new Set(Object.values(continentMapping));
    Array.from(uniqueContinents).sort().forEach(continent => {
        continentSelect.add(new Option(continent, continent));
    });

    // Länder
    Object.keys(continentMapping).sort().forEach(country => {
        countrySelect.add(new Option(country, country));
    });

    // Masterliste sichern
    countryOptionsMaster = Array.from(countrySelect.options)
        .filter(o => o.value !== 'all')
        .map(o => ({ value: o.value, text: o.text }));

    // Suchfeld-Ereignis
    countrySearch.addEventListener('input', () => {
        filterCountryOptions(countrySearch.value);
    });

    // Themencluster
    Object.keys(topicClusters).sort().forEach(cluster => {
        topicClusterSelect.add(new Option(cluster, cluster));
    });

    function deselectAllOption(selectElement) {
        const allOption = selectElement.querySelector('option[value="all"]');
        if (allOption && allOption.selected) {
            allOption.selected = false;
        }
    }

    continentSelect.addEventListener('change', () => { deselectAllOption(continentSelect); applyFilters(); updateCharts(); });
    countrySelect.addEventListener('change', () => { deselectAllOption(countrySelect); applyFilters(); updateCharts(); });
    topicClusterSelect.addEventListener('change', () => { deselectAllOption(topicClusterSelect); applyFilters(); updateCharts(); });

    document.getElementById('resetFilters').addEventListener('click', resetFilters);
}

// Länderoptionen filtern
function filterCountryOptions(query) {
    const q = query.trim().toLowerCase();
    const filtered = q
        ? countryOptionsMaster.filter(o => o.text.toLowerCase().includes(q))
        : countryOptionsMaster;

    rebuildCountrySelect(filtered);
}

function rebuildCountrySelect(list) {
    const countrySelect = document.getElementById('countrySelect');
    const selectedValues = new Set(Array.from(countrySelect.selectedOptions).map(o => o.value));

    countrySelect.length = 0;
    countrySelect.add(new Option('All Countries', 'all'));

    list.forEach(({ value, text }) => {
        const opt = new Option(text, value);
        if (selectedValues.has(value)) opt.selected = true;
        countrySelect.add(opt);
    });
}

// Filter anwenden
function applyFilters() {
    selectedContinent = Array.from(document.getElementById('continentSelect').selectedOptions).map(o => o.value);
    selectedCountry = Array.from(document.getElementById('countrySelect').selectedOptions).map(o => o.value);
    selectedTopics = Array.from(document.getElementById('topicClusterSelect').selectedOptions).map(o => o.value);

    console.log("Selected Filters:", selectedContinent, selectedCountry, selectedTopics);
}

// Reset
function resetFilters() {
    document.getElementById('continentSelect').selectedIndex = 0;
    document.getElementById('countrySelect').selectedIndex = 0;
    document.getElementById('topicClusterSelect').selectedIndex = 0;
    document.getElementById('countrySearch').value = '';
    filterCountryOptions('');

    selectedContinent = [];
    selectedCountry = [];
    selectedTopics = [];
    updateCharts();
}

// Diagramme aktualisieren
function updateCharts() {
    applyFilters();
    updateCountryChart();
    updateTopicClustersOverTime();
    updateTopicsByContinent();
    updateCoOccurrenceNetwork();

    document.querySelectorAll('.plotly-chart').forEach(chart => {
        chart.style.minWidth = '800px';
    });
}

// Farben
function getClusterColors() {
    let clusterColors = {};
    Object.keys(topicClusters).forEach(cluster => {
        clusterColors[cluster] = topicClusters[cluster].color;
    });
    return clusterColors;
}

const plotlyLayout = {
    barmode: 'stack',
    autosize: true,
    responsive: true,
    paper_bgcolor: '#333',
    plot_bgcolor: '#333',
    font: { color: 'white' },
    xaxis: { automargin: true, tickangle: -45, showgrid: true },
    yaxis: { automargin: true, showgrid: true }
};

// Filter auf Kunstwerke
function filterArtworks(artworks) {
    return artworks.features.filter(artwork => {
        const country = artwork.properties.location.split(", ").pop().trim();
        const continent = continentMapping[country] || "Other";

        if (selectedContinent.length > 0 && !selectedContinent.includes(continent) && !selectedContinent.includes('all')) return false;
        if (selectedCountry.length > 0 && !selectedCountry.includes(country) && !selectedCountry.includes('all')) return false;

        const topics = artwork.properties.tags.topic;
        const clusters = topics.map(topic => Object.keys(topicClusters).find(cluster => topicClusters[cluster].topics.includes(topic))).filter(Boolean);
        if (selectedTopics.length > 0 && !selectedTopics.some(cluster => clusters.includes(cluster)) && !selectedTopics.includes('all')) return false;

        return true;
    });
}

// Charts
function updateCountryChart() { /* ... deine bestehende Funktion ... */ }
function updateTopicClustersOverTime() { /* ... bestehende Funktion ... */ }
function updateTopicsByContinent() { /* ... bestehende Funktion ... */ }
function updateCoOccurrenceNetwork() { /* ... bestehende Funktion ... */ }

// Lade die Daten
loadData();
