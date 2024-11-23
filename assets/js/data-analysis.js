// Global variables
let countries = [];
let topicClusters = {};
let countryChart; // Variable to hold the chart instance

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

        // Automatically load data for all countries when page loads
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
 * Filter and load data for Topic Cluster by Country
 */
async function loadCountryData(selectedCountry = null) {
    try {
        console.log("Fetching artwork data for country filtering...");
        const artworkResponse = await fetch('data/artwork-data.json');
        const data = await artworkResponse.json();

        // Get selected countries
        const selectedCountries = selectedCountry
            ? [selectedCountry]
            : Array.from(document.getElementById('countrySelect').selectedOptions).map(option => option.value);

        const tagsByCountry = {};

        data.features.forEach((feature) => {
            const location = feature.properties.location || "";
            const locationParts = location.split(', ');
            const country = locationParts.length > 1 ? locationParts[1].trim() : locationParts[0].trim();

            // If "All Countries" is selected or the country matches the selection
            if (selectedCountries.includes("all") || selectedCountries.includes(country)) {
                if (!tagsByCountry[country]) tagsByCountry[country] = {};

                const topics = feature.properties.tags?.topic || [];
                topics.forEach(topic => {
                    // Find the cluster for each topic
                    for (const [clusterName, clusterInfo] of Object.entries(topicClusters)) {
                        if (clusterInfo.topics.includes(topic)) {
                            tagsByCountry[country][clusterName] = (tagsByCountry[country][clusterName] || 0) + 1;
                        }
                    }
                });
            }
        });

        console.log("Tags by Country Processed:", tagsByCountry);

        // Pass the processed data to the chart function
        createCountryClusterChart(tagsByCountry);
    } catch (error) {
        console.error("Error loading country data:", error);
    }
}

/**
 * Create bar chart for topic clusters by country
 */
function createCountryClusterChart(data) {
    if (!data || typeof data !== "object") {
        console.error("Invalid data passed to createCountryClusterChart:", data);
        return;
    }

    const ctx = document.getElementById('countryChart').getContext('2d');

    // Destroy existing chart if any
    if (countryChart) {
        countryChart.destroy();
    }

    const countriesArray = Object.keys(data).sort(); // Sort countries alphabetically
    const clusters = new Set();

    // Collect all unique clusters for dataset generation
    countriesArray.forEach(country => {
        Object.keys(data[country]).forEach(cluster => {
            clusters.add(cluster);
        });
    });

    // Prepare datasets for each cluster
    const datasets = Array.from(clusters).map(cluster => ({
        label: cluster,
        data: countriesArray.map(country => data[country]?.[cluster] || 0), // Value per country
        backgroundColor: topicClusters[cluster]?.color || "#ccc",
    }));

    // Sum up all clusters for the stacked bar total
    const totals = countriesArray.map(country =>
        Object.values(data[country] || {}).reduce((sum, value) => sum + value, 0)
    );

    console.log("Countries in Chart:", countriesArray);
    console.log("Prepared Datasets:", datasets);
    console.log("Total Values for Countries:", totals);

    // Create the chart
    countryChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: countriesArray, // Each country is a separate bar
            datasets: datasets, // Stacked datasets for each cluster
        },
        options: {
            plugins: {
                title: {
                    display: true,
                    text: 'Topic Clusters by Country',
                },
                tooltip: {
                    callbacks: {
                        label: context => `${context.dataset.label}: ${context.raw}`,
                    },
                },
            },
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true },
                y: { 
                    stacked: true, // Enable stacking for totals
                    beginAtZero: true,
                },
            },
        },
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
