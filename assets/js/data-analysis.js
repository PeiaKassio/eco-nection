// Global variables
let countries = [];
let topicClusters = {};
let countryChart;
let topicClustersOverTimeChart;
let coOccurrenceNetwork; // For Network Graph

/**
 * Load and analyze the data
 */
async function loadData() {
    try {
        console.log("Fetching artwork data...");
        const artworkResponse = await fetch('data/artwork-data.json');
        const data = await artworkResponse.json();
        console.log("Artwork Data Loaded:", data);

        // Populate country selection with countries that have data
        countries = [...new Set(data.features
            .map(feature => {
                const location = feature.properties.location || "";
                const locationParts = location.split(', ');
                return locationParts.length > 1 ? locationParts[1].trim() : locationParts[0].trim(); // Extract country or fallback
            })
            .filter(Boolean))]; // Remove empty entries
        console.log("Countries Extracted:", countries);

        populateCountryDropdown();

        console.log("Fetching topic cluster data...");
        const clusterResponse = await fetch('data/topicClusters.json');
        topicClusters = await clusterResponse.json();
        console.log("Topic Clusters Loaded:", topicClusters);

        // Automatically load data for all countries when the page loads
        loadCountryData("all");
    } catch (error) {
        console.error("Error loading data:", error);
    }
}

/**
 * Populate country dropdown with "All Countries" option
 */
function populateCountryDropdown() {
    const countrySelect = document.getElementById('countrySelect');
    countrySelect.innerHTML = ""; // Clear existing options

    // Add "All Countries" option
    const allOption = document.createElement('option');
    allOption.value = "all";
    allOption.textContent = "All Countries";
    countrySelect.appendChild(allOption);

    // Add individual countries
    countries.sort().forEach(country => {
        const option = document.createElement('option');
        option.value = country;
        option.textContent = country;
        countrySelect.appendChild(option);
    });
    console.log("Country Dropdown Populated");
}

/**
 * Filter and load data for Topic Clusters by Country and Over Time
 */
async function loadCountryData(selectedCountry = null) {
    try {
        console.log("Fetching artwork data for country filtering...");
        const artworkResponse = await fetch('data/artwork-data.json');
        const data = await artworkResponse.json();

        const selectedCountries = selectedCountry
            ? [selectedCountry]
            : Array.from(document.getElementById('countrySelect').selectedOptions).map(option => option.value);

        const filteredData = {
            type: "FeatureCollection",
            features: data.features.filter((feature) => {
                const location = feature.properties.location || "";
                const locationParts = location.split(', ');
                const country = locationParts.length > 1 ? locationParts[1].trim() : locationParts[0].trim();
                return selectedCountries.includes("all") || selectedCountries.includes(country);
            }),
        };

        console.log("Filtered Data for Selected Countries:", filteredData);

        // Update all charts with filtered data
        createCountryClusterChart(filteredData);
        initializeTopicClustersOverTimeChart(filteredData);
        initializeCoOccurrenceNetwork(filteredData);
    } catch (error) {
        console.error("Error loading country data:", error);
    }
}

/**
 * Create bar chart for topic clusters by country
 */
function createCountryClusterChart(filteredData) {
    const ctx = document.getElementById('countryChart').getContext('2d');

    if (!filteredData || typeof filteredData !== "object") {
        console.error("Invalid data passed to createCountryClusterChart:", filteredData);
        return;
    }

    // Destroy existing chart if any
    if (countryChart) {
        countryChart.destroy();
    }

    const tagsByCountry = {};

    filteredData.features.forEach(feature => {
        const location = feature.properties.location || "";
        const locationParts = location.split(', ');
        const country = locationParts.length > 1 ? locationParts[1].trim() : locationParts[0].trim();

        const topics = feature.properties.tags?.topic || [];
        topics.forEach(topic => {
            for (const [clusterName, clusterInfo] of Object.entries(topicClusters)) {
                if (clusterInfo.topics.includes(topic)) {
                    if (!tagsByCountry[country]) tagsByCountry[country] = {};
                    tagsByCountry[country][clusterName] = (tagsByCountry[country][clusterName] || 0) + 1;
                }
            }
        });
    });

    const countriesArray = Object.keys(tagsByCountry).sort(); // Sort countries alphabetically
    const clusters = new Set();

    countriesArray.forEach(country => {
        Object.keys(tagsByCountry[country]).forEach(cluster => {
            clusters.add(cluster);
        });
    });

    const datasets = Array.from(clusters).map(cluster => ({
        label: cluster,
        data: countriesArray.map(country => tagsByCountry[country]?.[cluster] || 0),
        backgroundColor: topicClusters[cluster]?.color || "#ccc",
    }));

    countryChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: countriesArray,
            datasets: datasets,
        },
        options: {
            plugins: {
                title: {
                    display: true,
                    text: 'Topic Clusters by Country',
                },
            },
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true },
                y: { stacked: true, beginAtZero: true },
            },
        },
    });
}

/**
 * Initialize "Change of Topic Clusters Over Time" chart
 */
function initializeTopicClustersOverTimeChart(filteredData) {
    const ctx = document.getElementById('topicClustersOverTimeChart').getContext('2d');
    const clusterYearCounts = {};

    filteredData.features.forEach(feature => {
        const year = feature.properties.year || "Unknown";
        const topics = feature.properties.tags?.topic || [];

        topics.forEach(topic => {
            for (const [clusterName, clusterInfo] of Object.entries(topicClusters)) {
                if (clusterInfo.topics.includes(topic)) {
                    if (!clusterYearCounts[clusterName]) clusterYearCounts[clusterName] = {};
                    clusterYearCounts[clusterName][year] = (clusterYearCounts[clusterName][year] || 0) + 1;
                }
            }
        });
    });

    const years = Array.from(new Set(Object.values(clusterYearCounts).flatMap(yearData => Object.keys(yearData)))).sort();
    const datasets = Object.entries(clusterYearCounts).map(([cluster, yearCounts]) => ({
        label: cluster,
        data: years.map(year => yearCounts[year] || 0),
        fill: false,
        borderColor: topicClusters[cluster]?.color || "#ccc",
    }));

    if (topicClustersOverTimeChart) {
        topicClustersOverTimeChart.destroy();
    }

    topicClustersOverTimeChart = new Chart(ctx, {
        type: 'line',
        data: { labels: years, datasets: datasets },
        options: {
            plugins: {
                title: {
                    display: true,
                    text: 'Change of Topic Clusters Over Time',
                },
            },
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { title: { display: true, text: 'Year' } },
                y: { title: { display: true, text: 'Frequency' } },
            },
        },
    });
}

/**
 * Calculate Co-Occurrence of Topic Clusters
 */
function calculateCoOccurrences(filteredData) {
    const coOccurrenceCounts = {};

    filteredData.features.forEach(feature => {
        const topics = feature.properties.tags?.topic || [];

        // Identify clusters for each topic
        const clusters = new Set(
            topics.flatMap(topic =>
                Object.entries(topicClusters).filter(([_, clusterInfo]) =>
                    clusterInfo.topics.includes(topic)
                ).map(([clusterName]) => clusterName)
            )
        );

        // Count co-occurrences
        const clusterArray = Array.from(clusters);
        for (let i = 0; i < clusterArray.length; i++) {
            for (let j = i + 1; j < clusterArray.length; j++) {
                const pair = [clusterArray[i], clusterArray[j]].sort().join('-');
                coOccurrenceCounts[pair] = (coOccurrenceCounts[pair] || 0) + 1;
            }
        }
    });

    return coOccurrenceCounts;
}

/**
 * Initialize Network Graph for Co-Occurrence
 */
function initializeCoOccurrenceNetwork(filteredData) {
    const coOccurrences = calculateCoOccurrences(filteredData);

    const nodes = [];
    const edges = [];

    Object.entries(coOccurrences).forEach(([pair, count]) => {
        const [clusterA, clusterB] = pair.split('-');

        if (!nodes.find(node => node.id === clusterA)) {
            nodes.push({ id: clusterA, label: clusterA, color: topicClusters[clusterA]?.color || '#ccc' });
        }

        if (!nodes.find(node => node.id === clusterB)) {
            nodes.push({ id: clusterB, label: clusterB, color: topicClusters[clusterB]?.color || '#ccc' });
        }

        edges.push({
            from: clusterA,
            to: clusterB,
            value: count,
            color: '#666',
        });
    });

    const container = document.getElementById('coOccurrenceNetwork');
    const networkData = { nodes, edges };

    const options = {
        nodes: {
            shape: 'dot',
            size: 20,
            font: { size: 12 }
        },
        edges: {
            smooth: true,
        },
        physics: {
            barnesHut: { gravitationalConstant: -8000 },
            stabilization: { iterations: 2500 }
        },
    };

    new vis.Network(container, networkData, options);
}

/**
 * Filter countries based on search input
 */
function filterCountries() {
    const input = document.getElementById('countrySearch').value.toLowerCase();
    const select = document.getElementById('countrySelect');

    Array.from(select.options).forEach(option => {
        const text = option.text.toLowerCase();
        option.style.display = text.includes(input) ? '' : 'none';
    });
    console.log("Country Filter Applied");
}

/**
 * Event Listeners
 */
document.getElementById('applyCountryFilter').addEventListener('click', () => {
    const selectedValue = document.getElementById('countrySelect').value;
    loadCountryData(selectedValue === "all" ? "all" : selectedValue);
});
document.getElementById('countrySearch').addEventListener('input', filterCountries);

// Initial data load
loadData();
