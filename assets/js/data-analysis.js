// Globale Variablen für Daten
let artworks = [];
let topicClusters = {};
let continentMapping = {};

// Filterwerte
let selectedContinent = [];
let selectedCountry = [];
let selectedTopics = [];

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

    continentSelect.add(new Option('All Continents', 'all'));
    countrySelect.add(new Option('All Countries', 'all'));
    topicClusterSelect.add(new Option('All Topic Clusters', 'all'));

    let uniqueContinents = new Set(Object.values(continentMapping));
    let sortedContinents = Array.from(uniqueContinents).sort();
    sortedContinents.forEach(continent => continentSelect.add(new Option(continent, continent)));

    let sortedCountries = Object.keys(continentMapping).sort();
    sortedCountries.forEach(country => countrySelect.add(new Option(country, country)));

    let sortedTopicClusters = Object.keys(topicClusters).sort();
    sortedTopicClusters.forEach(cluster => topicClusterSelect.add(new Option(cluster, cluster)));

    continentSelect.addEventListener('change', () => { applyFilters(); updateCharts(); });
    countrySelect.addEventListener('change', () => { applyFilters(); updateCharts(); });
    topicClusterSelect.addEventListener('change', () => { applyFilters(); updateCharts(); });

    document.getElementById('resetFilters').addEventListener('click', resetFilters);
}

// Diagramme aktualisieren
function updateCharts() {
    applyFilters();
    updateCountryChart();
    updateTopicClustersOverTime();
    updateTopicsByContinent();
    updateCoOccurrenceNetwork();

    document.querySelectorAll('.chart-container').forEach(container => {
        container.classList.add('overflow-x-auto', 'whitespace-nowrap');
    });

    document.querySelectorAll('.plotly-chart').forEach(chart => {
        chart.classList.add('min-w-[900px]');
    });
}

// Plotly Layout
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

// Themencluster nach Kontinent
function updateTopicsByContinent() {
    let continentData = {};
    let clusterColors = getClusterColors();
    let filteredArtworks = filterArtworks(artworks);

    filteredArtworks.forEach(artwork => {
        let country = artwork.properties.location.split(", ").pop();
        let continent = continentMapping[country] || "Other";
        let cluster = artwork.properties.tags.topic.map(topic => Object.keys(topicClusters).find(cluster => topicClusters[cluster].topics.includes(topic))).filter(Boolean);

        if (!continentData[continent]) continentData[continent] = {};
        cluster.forEach(c => continentData[continent][c] = (continentData[continent][c] || 0) + 1);
    });

    let traces = Object.keys(clusterColors).map(cluster => ({
        x: Object.keys(continentData),
        y: Object.values(continentData).map(data => data[cluster] || 0),
        name: cluster,
        type: 'bar',
        marker: { color: clusterColors[cluster] }
    }));

    Plotly.newPlot('topicsByContinentChart', traces, plotlyLayout);
}

// Lade die Daten
loadData();