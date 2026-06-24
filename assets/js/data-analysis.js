// Globale Variablen für Daten
let artworks = [];
let topicClusters = {};
let continentMapping = {};
let countryPopulation = {};

// Filterwerte
let selectedContinent = [];
let selectedCountry = [];
let selectedTopics = [];
let selectedMetric = 'total';
const { loadSharedData, normalizeText, parseYear } = EcoData;

// -----------------------------
// Utils für Suche & Debounce
// -----------------------------
function debounce(fn, wait = 120) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

function getCountryFromLocation(location) {
    return EcoData.getCountryFromLocation(location, continentMapping, countryPopulation);
}

function getContinentForCountry(country) {
    return EcoData.getContinentForCountry(country, continentMapping);
}

function getArtworkClusters(artwork) {
    return EcoData.getArtworkClusters(artwork, topicClusters);
}

function getMetricLabel() {
    return selectedMetric === 'perCapita' ? 'Artworks per 1M people' : 'Artwork count';
}

function updateChartTitles() {
    const perCapita = selectedMetric === 'perCapita';
    document.getElementById('topicsByContinentTitle').textContent = perCapita
        ? 'Topic Clusters per 1M People by Continent'
        : 'Number of Topics by Continent';
    document.getElementById('countryChartTitle').textContent = perCapita
        ? 'Topic Clusters per 1M People by Country'
        : 'Number of Topic Clusters by Country';
    document.getElementById('topicClustersOverTimeTitle').textContent = perCapita
        ? 'Topic Clusters per 1M People Over Time'
        : 'Change of Topic Clusters Over Time';

    const countryChartPopulationNote = document.getElementById('countryChartPopulationNote');
    if (countryChartPopulationNote) {
        countryChartPopulationNote.classList.toggle('hidden', !perCapita);
    }
}

function normalizeValue(count, population) {
    return EcoData.normalizePerCapita(count, population, selectedMetric);
}

function shouldIncludeCountryInChart(country) {
    return selectedMetric !== 'perCapita' || !EcoData.isSmallPopulationBase(countryPopulation[country]);
}

function sumPopulation(countries) {
    return Array.from(countries).reduce((sum, country) => {
        return sum + (countryPopulation[country] || 0);
    }, 0);
}

// Länder-Sichtbarkeit auf Basis von Kontinent-Filter + Textsuche
function refreshCountryListVisibility() {
  const countrySelect = document.getElementById('countrySelect');
  if (!countrySelect) return;

  const query = normalizeText(document.getElementById('countrySearch')?.value?.trim() || "");

  // aktuell gewählte Kontinente (inkl. "all")
  const continents = Array.from(document.getElementById('continentSelect').selectedOptions)
    .map(o => o.value);

  for (const opt of countrySelect.options) {
    if (opt.value === 'all') {
      opt.hidden = false;
      continue;
    }

    const country = opt.value;
    const continent =
      continentMapping[country] ||
      continentMapping[country?.toLowerCase()] ||
      'Other';

    const matchesContinent =
      continents.length === 0 ||
      continents.includes('all') ||
      continents.includes(continent);

    const matchesQuery = query === "" || normalizeText(opt.text).includes(query);

    const visible = matchesContinent && matchesQuery;

    // ausblenden + ggf. Auswahl entfernen, damit nichts unsichtbar ausgewählt bleibt
    opt.hidden = !visible;
    if (!visible && opt.selected) opt.selected = false;
  }
}

// Suchfeld initialisieren
function setupCountrySearch() {
  const input = document.getElementById('countrySearch');
  if (!input) return;
  input.addEventListener('input', debounce(() => {
    refreshCountryListVisibility();
    applyFilters();
    updateCharts();
  }));
}

// Daten laden
async function loadData() {
    try {
        ({ artworkData: artworks, topicClusters, continentMapping, countryPopulation } = await loadSharedData());

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
    continentSelect.addEventListener('change', () => {
        deselectAllOption(continentSelect);
        applyFilters();
        refreshCountryListVisibility(); // <- neu: Länderansicht aktualisieren, wenn Kontinente geändert werden
        updateCharts();
    });

    countrySelect.addEventListener('change', () => { 
        deselectAllOption(countrySelect); 
        applyFilters(); 
        updateCharts(); 
    });

    topicClusterSelect.addEventListener('change', () => { 
        deselectAllOption(topicClusterSelect); 
        applyFilters(); 
        updateCharts(); 
    });

    document.querySelectorAll('input[name="metricMode"]').forEach(input => {
        input.addEventListener('change', () => {
            selectedMetric = input.value;
            updateCharts();
        });
    });

    document.getElementById('resetFilters').addEventListener('click', resetFilters);

    // NEU: Country-Suche initialisieren + initiale Sichtbarkeit setzen
    setupCountrySearch();
    refreshCountryListVisibility();
}

// Filter auf Daten anwenden
function applyFilters() {
    selectedContinent = Array.from(document.getElementById('continentSelect').selectedOptions).map(option => option.value);
    selectedCountry = Array.from(document.getElementById('countrySelect').selectedOptions).map(option => option.value);
    selectedTopics = Array.from(document.getElementById('topicClusterSelect').selectedOptions).map(option => option.value);
    selectedMetric = document.querySelector('input[name="metricMode"]:checked')?.value || 'total';

    console.log("Selected Filters:", selectedContinent, selectedCountry, selectedTopics);
}

// Reset-Filter
function resetFilters() {
    document.getElementById('continentSelect').selectedIndex = 0;
    document.getElementById('countrySelect').selectedIndex = 0;
    document.getElementById('topicClusterSelect').selectedIndex = 0;
    const cs = document.getElementById('countrySearch');
    if (cs) cs.value = ""; // neu: Suchfeld leeren
    const totalMetric = document.querySelector('input[name="metricMode"][value="total"]');
    if (totalMetric) totalMetric.checked = true;

    selectedContinent = [];
    selectedCountry = [];
    selectedTopics = [];
    selectedMetric = 'total';

    refreshCountryListVisibility(); // neu: Sichtbarkeit nach Reset aktualisieren
    updateCharts();
}

// Diagramme aktualisieren
function updateCharts() {
    applyFilters();
    updateChartTitles();
    updateCountryChart();
    updateTopicClustersOverTime();
    updateTopicsByContinent();
    updateCoOccurrenceNetwork();

    document.querySelectorAll('.plotly-chart').forEach(chart => {
        chart.style.minWidth = '800px';
    });
}

// Hilfsfunktion für Farben
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
        const country = getCountryFromLocation(artwork.properties.location);
        const continent = getContinentForCountry(country);

        if (selectedContinent.length > 0 && !selectedContinent.includes(continent) && !selectedContinent.includes('all')) {
            return false;
        }

        if (selectedCountry.length > 0 && !selectedCountry.includes(country) && !selectedCountry.includes('all')) {
            return false;
        }

        const clusters = getArtworkClusters(artwork);
        if (selectedTopics.length > 0 && !selectedTopics.some(cluster => clusters.includes(cluster)) && !selectedTopics.includes('all')) {
            return false;
        }

        return true;
    });
}

// Themencluster nach Land
function updateCountryChart() {
    let countryData = {};
    let clusterColors = EcoData.getClusterColors(topicClusters);
    let filteredArtworks = filterArtworks(artworks);

    filteredArtworks.forEach(artwork => {
        let country = getCountryFromLocation(artwork.properties.location);
        let cluster = getArtworkClusters(artwork);

        if (!countryData[country]) countryData[country] = {};
        cluster.forEach(c => {
            if (!countryData[country][c]) countryData[country][c] = 0;
            countryData[country][c]++;
        });
    });

    const visibleCountries = Object.keys(countryData).filter(shouldIncludeCountryInChart);

    let traces = Object.keys(clusterColors).map(cluster => ({
        x: visibleCountries,
        y: visibleCountries.map(country => normalizeValue(countryData[country][cluster] || 0, countryPopulation[country])),
        name: cluster,
        type: 'bar',
        marker: { color: clusterColors[cluster] },
        hovertemplate: `%{x}<br>${cluster}: %{y:.3f}<extra></extra>`
    }));

    Plotly.newPlot('countryChart', traces, {
        ...plotlyLayout,
        yaxis: { ...plotlyLayout.yaxis, title: getMetricLabel() }
    });
}

// Themencluster über die Zeit (Liniendiagramm)
function updateTopicClustersOverTime() {
    let timeData = {};
    let clusterColors = EcoData.getClusterColors(topicClusters);
    let filteredArtworks = filterArtworks(artworks);
    let filteredCountries = new Set(filteredArtworks.map(artwork => getCountryFromLocation(artwork.properties.location)));
    let populationBase = sumPopulation(filteredCountries);

    // Jahre sammeln & Themen zuordnen
    filteredArtworks.forEach(artwork => {
        let year = parseYear(artwork.properties.year);
        if (year === null) return;

        let cluster = getArtworkClusters(artwork);

        if (!timeData[year]) timeData[year] = {};
        cluster.forEach(c => {
            if (!timeData[year][c]) timeData[year][c] = 0;
            timeData[year][c]++;
        });
    });

    // Sortierte Jahre
    let years = Object.keys(timeData).map(Number).sort((a, b) => a - b);

    // Tickwerte (reduziert)
    let tickvals = years.filter((year, index) => index % 2 === 0);

    // Traces für jedes Cluster
    let traces = Object.keys(clusterColors).map(cluster => ({
        x: years,
        y: years.map(year => normalizeValue(timeData[year]?.[cluster] || 0, populationBase)),
        name: cluster,
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: clusterColors[cluster] || "#ffffff" }
    }));

    let layout = {
        title: 'Change of Topic Clusters Over Time',
        autosize: true,
        paper_bgcolor: '#333',
        plot_bgcolor: '#333',
        font: { color: 'white' },
        xaxis: {
            title: 'Year',
            tickmode: "array",
            tickvals: tickvals,
            showgrid: false,
            showline: true,
            zeroline: false
        },
        yaxis: {
            title: getMetricLabel(),
            showgrid: true,
            zeroline: true
        }
    };

    Plotly.newPlot('topicClustersOverTimeChart', traces, layout);
}

// Themencluster nach Kontinent
function updateTopicsByContinent() {
    let continentData = {};
    let clusterColors = EcoData.getClusterColors(topicClusters);
    let filteredArtworks = filterArtworks(artworks);

    filteredArtworks.forEach(artwork => {
        let country = getCountryFromLocation(artwork.properties.location);
        let continent = getContinentForCountry(country);
        let cluster = getArtworkClusters(artwork);

        if (!continentData[continent]) continentData[continent] = { countries: new Set() };
        continentData[continent].countries.add(country);
        cluster.forEach(c => {
            if (!continentData[continent][c]) continentData[continent][c] = 0;
            continentData[continent][c]++;
        });
    });

    let traces = Object.keys(clusterColors).map(cluster => ({
        x: Object.keys(continentData),
        y: Object.keys(continentData).map(continent => {
            const population = sumPopulation(continentData[continent].countries);
            return normalizeValue(continentData[continent][cluster] || 0, population);
        }),
        name: cluster,
        type: 'bar',
        marker: { color: clusterColors[cluster] },
        hovertemplate: `%{x}<br>${cluster}: %{y:.3f}<extra></extra>`
    }));

    Plotly.newPlot('topicsByContinentChart', traces, {
        ...plotlyLayout,
        yaxis: { ...plotlyLayout.yaxis, title: getMetricLabel() }
    });
}

// Co-Occurrence-Netzwerk
function updateCoOccurrenceNetwork() {
    let nodes = [];
    let edges = [];
    let clusterColors = EcoData.getClusterColors(topicClusters);
    let filteredArtworks = filterArtworks(artworks);
    let nodeSet = new Set();

    filteredArtworks.forEach(artwork => {
        let clusterList = getArtworkClusters(artwork);

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
