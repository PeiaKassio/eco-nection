// Global variables
let countries = [];
let topicClusters = {};
let countryChart; // Variable to hold the chart instance

/**
 * Load and analyze the data
 */
async function loadData() {
    try {
        const artworkResponse = await fetch('data/artwork-data.json');
        const data = await artworkResponse.json();

        // Populate country selection with countries that have data
        countries = [...new Set(data.features
            .map(feature => {
                const location = feature.properties.location || "";
                const locationParts = location.split(', ');
                return locationParts.length > 1 ? locationParts[1] : locationParts[0]; // Extract country or fallback
            })
            .filter(Boolean))]; // Remove empty entries
        
        populateCountryDropdown();

        // Load topic clusters
        const clusterResponse = await fetch('data/topicClusters.json');
        topicClusters = await clusterResponse.json();

        // Automatically load data for all countries when page loads
        loadCountryData();
    } catch (error) {
        console.error("Error loading data:", error);
    }
}

/**
 * Populate country dropdown
 */
function populateCountryDropdown() {
    const countrySelect = document.getElementById('countrySelect');
    countrySelect.innerHTML = ""; // Clear existing options

    countries.sort().forEach(country => {
        const option = document.createElement('option');
        option.value = country;
        option.textContent = country;
        countrySelect.appendChild(option);
    });
}

/**
 * Filter and load data for Topic Cluster by Country
 */
async function loadCountryData() {
    try {
        const selectedCountries = Array.from(document.getElementById('countrySelect').selectedOptions)
            .map(option => option.value);
        
        const artworkResponse = await fetch('data/artwork-data.json');
        const data = await artworkResponse.json();

        const tagsByCountry = {};

        data.features.forEach((feature) => {
            const location = feature.properties.location || "";
            const locationParts = location.split(', ');
            const country = locationParts.length > 1 ? locationParts[1] : locationParts[0]; // Extract country

            if (selectedCountries.includes(country)) {
                const topics = feature.properties.tags?.topic || [];
                topics.forEach(topic => {
                    // Find the cluster for each topic
                    for (const [clusterName, clusterInfo] of Object.entries(topicClusters)) {
                        if (clusterInfo.topics.includes(topic)) {
                            if (!tagsByCountry[country]) tagsByCountry[country] = {};
                            tagsByCountry[country][clusterName] = (tagsByCountry[country][clusterName] || 0) + 1; // Count occurrences
                        }
                    }
                });
            }
        });

        createCountryClusterChart(tagsByCountry);
    } catch (error) {
        console.error("Error loading country data:", error);
    }
}

/**
 * Create bar chart for topic clusters by country
 */
function createCountryClusterChart(data) {
    const ctx = document.getElementById('countryChart').getContext('2d');

    // Destroy existing chart if any
    if (countryChart) {
        countryChart.destroy();
    }

    const datasets = [];
    const countriesArray = Object.keys(data);

    countriesArray.forEach(country => {
        Object.keys(data[country]).forEach(cluster => {
            if (!datasets.find(dataset => dataset.label === cluster)) {
                datasets.push({
                    label: cluster,
                    data: countriesArray.map(c => (c === country ? data[country][cluster] : 0)),
                    backgroundColor: topicClusters[cluster]?.color || "#ccc", // Use color from clusters JSON
                });
            }
        });
    });

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
                    text: 'Topic Clusters by Country'
                },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.dataset.label}: ${context.raw}`
                    }
                }
            },
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true },
                y: { beginAtZero: true },
            },
        }
    });
}

/**
 * Filter countries based on search input
 */
function filterCountries() {
    const input = document.getElementById('countrySearch').value.toLowerCase();
    const select = document.getElementById('countrySelect');

    Array.from(select.options).forEach(option => {
        const text = option.text.toLowerCase();
        option.style.display = text.includes(input) ? '' : 'none'; // Show or hide based on search
    });
}

/**
 * Event Listeners
 */
document.getElementById('applyCountryFilter').addEventListener('click', loadCountryData);

document.getElementById('countrySearch').addEventListener('input', filterCountries);

// Initial data load
loadData();
