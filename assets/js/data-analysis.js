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

    // Funktion zum Entfernen von "All", wenn eine andere Option gewählt wird
    function deselectAllOption(selectElement) {
    const allOption = selectElement.querySelector('option[value="all"]');
    if (allOption && allOption.selected) {
        allOption.selected = false;
    }
}

    /// EventListener für Änderungen an den Filtern
    continentSelect.addEventListener('change', () => { deselectAllOption(continentSelect); applyFilters(); updateCharts(); });
    countrySelect.addEventListener('change', () => { deselectAllOption(countrySelect); applyFilters(); updateCharts(); });
    topicClusterSelect.addEventListener('change', () => { deselectAllOption(topicClusterSelect); applyFilters(); updateCharts(); });

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
        const country = artwork.properties.location.split(", ").pop().trim();
        const continent = country in continentMapping ? continentMapping[country] : (country.toLowerCase() in continentMapping ? continentMapping[country.toLowerCase()] : "Other");

        
        if (selectedContinent.length > 0 && !selectedContinent.includes(continent) && !selectedContinent.includes('all')) {
            return false;
        }

        
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
// Themencluster über die Zeit (Liniendiagramm)
function updateTopicClustersOverTime() {
    let timeData = {};
    let clusterColors = getClusterColors();
    let filteredArtworks = filterArtworks(artworks);

    // 📌 Jahre sammeln & Themen zuordnen
    filteredArtworks.forEach(artwork => {
        let year = parseInt(artwork.properties.year, 10);
        if (isNaN(year)) return;

        let cluster = artwork.properties.tags.topic.map(topic => {
            return Object.keys(topicClusters).find(cluster => topicClusters[cluster].topics.includes(topic));
        }).filter(Boolean);

        if (!timeData[year]) timeData[year] = {};
        cluster.forEach(c => {
            if (!timeData[year][c]) timeData[year][c] = 0;
            timeData[year][c]++;
        });
    });

    // 📌 Sortierte Jahre als X-Achse (damit kein Durcheinander entsteht)
    let years = Object.keys(timeData).map(Number).sort((a, b) => a - b);

    // 📌 Intervalle für Jahre (automatisch angepasst)
    let minYear = Math.min(...years);
    let maxYear = Math.max(...years);
    let yearInterval = Math.ceil((maxYear - minYear) / 10); // Automatische Intervallschritte (alle 5-10 Jahre)

    let tickvals = years.filter(year => year % yearInterval === 0); // Nur sinnvolle Ticks anzeigen

    // 📌 Traces für jedes Cluster erstellen
    let traces = Object.keys(clusterColors).map(cluster => ({
        x: years,
        y: years.map(year => timeData[year]?.[cluster] || 0), // Fehlende Werte mit 0 füllen
        name: cluster,
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: clusterColors[cluster] || "#ffffff" } // Fallback-Farbe
    }));

    // 📌 Layout optimieren
    let layout = {
        title: 'Change of Topic Clusters Over Time',
        autosize: true,
        paper_bgcolor: '#333',
        plot_bgcolor: '#333',
        font: { color: 'white' },
        xaxis: {
            title: 'Year',
            tickmode: "array",
            tickvals: tickvals: years.filter(year => year % 2 === 0),
            showgrid: false,
            showline: true,
            zeroline: false
        },
        yaxis: {
            title: 'Count',
            showgrid: true,
            zeroline: true
        }
    };

    // 📌 Diagramm aktualisieren
    Plotly.newPlot('topicClustersOverTimeChart', traces, layout);
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
