// Global variables
let countries = [];
let topicClusters = {};
let countryChart;
let topicClustersOverTimeChart;
let coOccurrenceNetwork; // For Network Graph

/**
 * Load and analyze the data
 */
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

        // Populate topic cluster filter
        populateClusterDropdown();

        // Automatically load data for all countries and topics when the page loads
        loadCountryData(["all"], false);
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
 * Populate topic cluster dropdown with "All Clusters" option
 */
function populateClusterDropdown(filteredTopics = null) {
    const clusterSelect = document.getElementById('clusterSelect');
    clusterSelect.innerHTML = ""; // Clear existing options

    // Add "All Clusters" option
    const allOption = document.createElement('option');
    allOption.value = "all";
    allOption.textContent = "All Clusters";
    clusterSelect.appendChild(allOption);

    // Populate with dynamically filtered topics or all topics
    const topicsToDisplay = filteredTopics || Object.entries(topicClusters);
    topicsToDisplay
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([cluster, clusterInfo]) => {
            const option = document.createElement('option');
            option.value = cluster;
            option.textContent = cluster;
            option.style.backgroundColor = clusterInfo.color || "#ccc";
            clusterSelect.appendChild(option);
        });

    console.log("Topic Dropdown Populated");
}

/**
 * Filter and load data for Topic Clusters by Country and Over Time
 */
async function loadCountryData(selectedCountries = ["all"], filterTopics = false) {
    try {
        console.log("Fetching artwork data...");
        const artworkResponse = await fetch('data/artwork-data.json');
        const data = await artworkResponse.json();

        // Get selected topic clusters
        const selectedClusters = Array.from(document.getElementById('clusterSelect').selectedOptions).map(option => option.value);
        const allClustersSelected = selectedClusters.includes("all");

        // Step 1: Filter data by selected countries
        const countryFilteredData = {
            type: "FeatureCollection",
            features: data.features.filter((feature) => {
                const location = feature.properties.location || "";
                const locationParts = location.split(', ');
                const country = locationParts.length > 1 ? locationParts[1].trim() : locationParts[0].trim();
                return selectedCountries.includes("all") || selectedCountries.includes(country);
            }),
        };

        // Step 2: Filter data by selected topic clusters
        const topicFilteredData = filterTopics && !allClustersSelected
            ? {
                type: "FeatureCollection",
                features: countryFilteredData.features.filter((feature) => {
                    const topics = feature.properties.tags?.topic || [];
                    return topics.some(topic => 
                        selectedClusters.some(cluster => 
                            topicClusters[cluster]?.topics.includes(topic) // Match topics to cluster
                        )
                    );
                }),
            }
            : countryFilteredData;

        console.log("Filtered Data for Selected Countries:", countryFilteredData);
        if (filterTopics && !allClustersSelected) {
            console.log("Filtered Data for Selected Topics:", topicFilteredData);
        }

        // Update charts with filtered data
        createCountryClusterChart(topicFilteredData);
        initializeTopicClustersOverTimeChart(topicFilteredData);

        // Always update the co-occurrence network with broader data
        initializeCoOccurrenceNetwork(topicFilteredData);
    } catch (error) {
        console.error("Error loading country data:", error);
    }
}


    
function updateTopicDropdown(filteredData) {
    const availableTopics = {};

    filteredData.features.forEach(feature => {
        const topics = feature.properties.tags?.topic || [];
        topics.forEach(topic => {
            for (const [clusterName, clusterInfo] of Object.entries(topicClusters)) {
                if (clusterInfo.topics.includes(topic)) {
                    availableTopics[clusterName] = clusterInfo;
                }
            }
        });
    });

    // Populate the topic dropdown with available topics
    populateClusterDropdown(Object.entries(availableTopics));
}

/**
 * Create bar chart for topic clusters by country
 */
function createCountryClusterChart(filteredData) {
    const ctx = document.getElementById('countryChart').getContext('2d');

    // Check for valid data
    if (!filteredData || typeof filteredData !== "object" || !Array.isArray(filteredData.features)) {
        console.error("Invalid data passed to createCountryClusterChart:", filteredData);
        return;
    }

    // Destroy existing chart if any
    if (countryChart) {
        countryChart.destroy();
    }

    const tagsByCountry = {};

    // Use a Set to avoid counting duplicates
    const processedFeatures = new Set();

    filteredData.features.forEach(feature => {
        const location = feature.properties?.location || "";
        const locationParts = location.split(', ');
        const country = locationParts.length > 1 ? locationParts[1].trim() : locationParts[0].trim();

        // Validate country data
        if (!country) {
            console.warn("Feature without valid country:", feature);
            return;
        }

        // Create a unique identifier for the feature
        const featureId = feature.properties?.id || JSON.stringify(feature.geometry);

        // Skip duplicates
        if (processedFeatures.has(featureId)) {
            return;
        }

        processedFeatures.add(featureId);

        // Extract topics and match them to clusters
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

    console.log("Tags by Country:", tagsByCountry);

    const countriesArray = Object.keys(tagsByCountry).sort(); // Sort countries alphabetically
    if (!countriesArray.length) {
        console.error("No valid countries found for chart data.");
        return;
    }

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
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Topic Clusters by Country',
                },
                legend: {
                    display: true,
                    position: 'top',
                },
            },
            scales: {
                x: { 
                    stacked: true, 
                    title: { display: true, text: 'Countries' } 
                },
                y: { 
                    stacked: true, 
                    beginAtZero: true, 
                    title: { display: true, text: 'Frequency' } 
                },
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
            legend: {
                display: false,
                position: 'top',
            },
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

    console.log("Filtered Data for Co-Occurrence Network:", filteredData.features);

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
            font: { size: 12 },
        },
        edges: {
            smooth: true,
        },
        physics: {
            barnesHut: { gravitationalConstant: -8000 },
            stabilization: { iterations: 2500 },
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


// Event listener for applying the country filter
document.getElementById('applyCountryFilter').addEventListener('click', () => {
    const countrySelect = document.getElementById('countrySelect');
    const selectedCountries = Array.from(countrySelect.selectedOptions).map(option => option.value);

    console.log("Applying Country Filter with Countries:", selectedCountries);

    // Apply country filter and refresh topics dynamically
    loadCountryData(selectedCountries, false);
});


document.getElementById('applyTopicFilter').addEventListener('click', () => {
    const countrySelect = document.getElementById('countrySelect');
    const selectedCountries = Array.from(countrySelect.selectedOptions).map(option => option.value);

    // Automatically set "All Countries" if no countries are selected
    const countriesToApply = selectedCountries.length === 0 || selectedCountries.includes("all") ? ["all"] : selectedCountries;

    console.log("Applying Topic Filter with Countries:", countriesToApply);

    // Apply the topic filter without refreshing the countries
    loadCountryData(countriesToApply, true);
});


// Event listener for the country search box
document.getElementById('countrySearch').addEventListener('input', filterCountries);


// Initial data load
loadData();
