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
        // JSON-Dateien aus dem 'data'-Ordner laden
        artworks = await fetch('data/artwork-data.json').then(res => {
            if (!res.ok) throw new Error('Failed to load artwork-data.json');
            return res.json();
        });

        topicClusters = await fetch('data/topicClusters.json').then(res => {
            if (!res.ok) throw new Error('Failed to load topicClusters.json');
            return res.json();
        });

        continentMapping = await fetch('data/continentMapping.json').then(res => {
            if (!res.ok) throw new Error('Failed to load continentMapping.json');
            return res.json();
        });

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

    // "Alle"-Option zu den Filtern hinzufügen
    continentSelect.add(new Option('All Continents', 'all'));
    countrySelect.add(new Option('All Countries', 'all'));
    topicClusterSelect.add(new Option('All Topic Clusters', 'all'));

    // Kontinente füllen (alphabetisch sortiert)
    let uniqueContinents = new Set(Object.values(continentMapping));
    let sortedContinents = Array.from(uniqueContinents).sort();
    sortedContinents.forEach(continent => {
        let option = new Option(continent, continent);
        continentSelect.add(option);
    });

    // Länder füllen (alphabetisch sortiert)
    let sortedCountries = Object.keys(continentMapping).sort();
    sortedCountries.forEach(country => {
        let option = new Option(country, country);
        countrySelect.add(option);
    });

    // Themencluster füllen (alphabetisch sortiert)
    let sortedTopicClusters = Object.keys(topicClusters).sort();
    sortedTopicClusters.forEach(cluster => {
        let option = new Option(cluster, cluster);
        topicClusterSelect.add(option);
    });

    // EventListener für Änderungen an den Filtern
    continentSelect.addEventListener('change', () => { applyFilters(); updateCharts(); });
    countrySelect.addEventListener('change', () => { applyFilters(); updateCharts(); });
    topicClusterSelect.addEventListener('change', () => { applyFilters(); updateCharts(); });

    document.getElementById('resetFilters').addEventListener('click', resetFilters);
}

// Filter auf Daten anwenden
function applyFilters() {
    selectedContinent = Array.from(document.getElementById('continentSelect').selectedOptions).map(option => option.value);
    selectedCountry = Array.from(document.getElementById('countrySelect').selectedOptions).map(option => option.value);
    selectedTopics = Array.from(document.getElementById('topicClusterSelect').selectedOptions).map(option => option.value);

    console.log("Selected Filters:", selectedContinent, selectedCountry, selectedTopics);
}

// Reset-Filter
function resetFilters() {
    document.getElementById('continentSelect').selectedIndex = 0;
    document.getElementById('countrySelect').selectedIndex = 0;
    document.getElementById('topicClusterSelect').selectedIndex = 0;

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

// Hilfsfunktion für Farben
function getClusterColors() {
    let clusterColors = {};
    Object.keys(topicClusters).forEach(cluster => {
        clusterColors[cluster] = topicClusters[cluster].color;
    });
    return clusterColors;
}

// Zentrales Plotly-Layout für alle Diagramme
const plotlyLayout = {
    barmode: 'stack',
    autosize: true,
    responsive: true,
    paper_bgcolor: '#333',
    plot_bgcolor: '#333',
    font: { color: 'white' },
    xaxis: {
        automargin: true,
        tickangle: -45,
        showgrid: true
    },
    yaxis: {
        automargin: true,
        showgrid: true
    }
};

// Filter auf die Kunstwerke anwenden
function filterArtworks(artworks) {
    return artworks.features.filter(artwork => {
        const continent = continentMapping[artwork.properties.location] || "Other";
        if (selectedContinent.length > 0 && !selectedContinent.includes(continent) && !selectedContinent.includes('all')) {
            return false;
        }

        const country = artwork.properties.location.split(", ").pop();
        if (selectedCountry.length > 0 && !selectedCountry.includes(country) && !selectedCountry.includes('all')) {
            return false;
        }

        const topics = artwork.properties.tags.topic;
        const clusters = topics.map(topic => Object.keys(topicClusters).find(cluster => topicClusters[cluster].topics.includes(topic))).filter(Boolean);
        if (selectedTopics.length > 0 && !selectedTopics.some(cluster => clusters.includes(cluster)) && !selectedTopics.includes('all')) {
            return false;
        }

        return true;
    });
}

// Themencluster nach Land
function updateCountryChart() {
    let countryData = {};
    let clusterColors = getClusterColors();
    let filteredArtworks = filterArtworks(artworks);

    filteredArtworks.forEach(artwork => {
        let country = artwork.properties.location.split(", ").pop();
        let cluster = artwork.properties.tags.topic.map(topic => Object.keys(topicClusters).find(cluster => topicClusters[cluster].topics.includes(topic))).filter(Boolean);

        if (!countryData[country]) countryData[country] = {};
        cluster.forEach(c => {
            if (!countryData[country][c]) countryData[country][c] = 0;
            countryData[country][c]++;
        });
    });

    let traces = Object.keys(clusterColors).map(cluster => ({
        x: Object.keys(countryData),
        y: Object.keys(countryData).map(country => countryData[country][cluster] || 0),
        name: cluster,
        type: 'bar',
        marker: { color: clusterColors[cluster] }
    }));

    Plotly.newPlot('countryChart', traces, plotlyLayout);
}

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
        cluster.forEach(c => {
            if (!continentData[continent][c]) continentData[continent][c] = 0;
            continentData[continent][c]++;
        });
    });

    let traces = Object.keys(clusterColors).map(cluster => ({
        x: Object.keys(continentData),
        y: Object.keys(continentData).map(continent => continentData[continent][cluster] || 0),
        name: cluster,
        type: 'bar',
        marker: { color: clusterColors[cluster] }
    }));

    Plotly.newPlot('topicsByContinentChart', traces, plotlyLayout);
}

    function updateTopicClustersOverTimeByContinent() {
    let timeData = {};
    let clusterColors = getClusterColors();
    let filteredArtworks = filterArtworks(artworks);

    filteredArtworks.forEach(artwork => {
        let year = artwork.properties.year;
        let country = artwork.properties.location.split(", ").pop();
        let continent = continentMapping[country] || "Other";

        let cluster = artwork.properties.tags.topic.map(topic => 
            Object.keys(topicClusters).find(cluster => topicClusters[cluster].topics.includes(topic))
        ).filter(Boolean);

        if (!timeData[continent]) timeData[continent] = {};
        if (!timeData[continent][year]) timeData[continent][year] = {};
        
        cluster.forEach(c => {
            if (!timeData[continent][year][c]) timeData[continent][year][c] = 0;
            timeData[continent][year][c]++;
        });
    });

    let sortedContinents = Object.keys(timeData).sort();
    let sortedYears = [...new Set(filteredArtworks.map(a => a.properties.year))].sort();

    let traces = Object.keys(clusterColors).map(cluster => ({
        x: sortedYears,
        y: sortedYears.map(year => 
            sortedContinents.map(continent => timeData[continent][year]?.[cluster] || 0).reduce((a, b) => a + b, 0)
        ),
        name: cluster,
        type: 'scatter',
        mode: 'lines+markers',
        marker: { color: clusterColors[cluster] }
    }));

    let layout = {
        title: "Change of Topic Clusters Over Time by Continent",
        autosize: true,
        responsive: true,
        paper_bgcolor: "#333",
        plot_bgcolor: "#333",
        font: { color: "white" },
        xaxis: {
            automargin: true,
            tickangle: -45,
            showgrid: true
        },
        yaxis: {
            automargin: true,
            showgrid: true
        }
    };

    Plotly.newPlot('topicClustersOverTimeByContinentChart', traces, layout);
}


        function updateCoOccurrenceNetwork() {
    let nodes = [];
    let edges = [];
    let clusterColors = getClusterColors();
    let filteredArtworks = filterArtworks(artworks);
    let nodeSet = new Set();

    filteredArtworks.forEach(artwork => {
        let clusterList = artwork.properties.tags.topic.map(topic => 
            Object.keys(topicClusters).find(cluster => topicClusters[cluster].topics.includes(topic))
        ).filter(Boolean);

        clusterList.forEach(source => {
            if (!nodeSet.has(source)) {
                nodes.push({ id: source, label: source, color: clusterColors[source] || "#FFFFFF", font: { color: 'white' } });
                nodeSet.add(source);
            }
            clusterList.forEach(target => {
                if (source !== target) {
                    let edge = edges.find(e => (e.from === source && e.to === target) || (e.from === target && e.to === source));
                    if (edge) {
                        edge.value++;
                    } else {
                        edges.push({ from: source, to: target, value: 1 });
                    }
                }
            });
        });
    });

    let container = document.getElementById('coOccurrenceNetwork');
    if (!container) {
        console.error("coOccurrenceNetwork element not found!");
        return;
    }

    let data = { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) };
    let options = {
        nodes: { shape: 'dot', size: 10 },
        edges: { width: 0.5, color: { color: '#999' }, smooth: { type: 'continuous' } }
    };

    new vis.Network(container, data, options);
}


// Lade die Daten
loadData();
