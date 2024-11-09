// Dummy data and Chart instances
let countryData = {}; // Initialize country data here
let yearData = {}; // Initialize year data here

let topicCountryChart, topicYearChart; // Chart instances

// Initialize country and year filters
function initializeFilters(data) {
    const countryFilter = document.getElementById('countryFilter');
    const countries = Array.from(new Set(data.map(item => item.properties.location.split(', ').pop())));
    
    countries.forEach(country => {
        const option = document.createElement('option');
        option.value = country;
        option.textContent = country;
        countryFilter.appendChild(option);
    });
}

// Load data and initialize charts
fetch('artwork-data.json')
    .then(response => response.json())
    .then(data => {
        // Prepare countryData and yearData based on data
        prepareAnalysisData(data.features);
        initializeFilters(data.features);

        // Initialize charts
        initializeTopicCountryChart();
        initializeTopicYearChart();
    });

// Prepare analysis data by country and year
function prepareAnalysisData(features) {
    countryData = {};
    yearData = {};

    features.forEach(feature => {
        const topic = feature.properties.tags.topic[0]; // Use first topic in list as main topic
        const country = feature.properties.location.split(', ').pop();
        const year = feature.properties.year;

        // Add data to countryData
        if (!countryData[country]) countryData[country] = {};
        if (!countryData[country][topic]) countryData[country][topic] = 0;
        countryData[country][topic]++;

        // Add data to yearData
        if (!yearData[year]) yearData[year] = {};
        if (!yearData[year][topic]) yearData[year][topic] = 0;
        yearData[year][topic]++;
    });
}

// Show the selected analysis section
function showAnalysis(type) {
    document.getElementById('topicCountryAnalysis').style.display = type === 'topicCountry' ? 'block' : 'none';
    document.getElementById('topicYearAnalysis').style.display = type === 'topicYear' ? 'block' : 'none';
}

// Initialize Topic Country Chart
function initializeTopicCountryChart() {
    const ctx = document.getElementById('topicCountryChart').getContext('2d');
    topicCountryChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [], // Filled in update function
            datasets: [{
                label: 'Topic Clusters by Country',
                data: [],
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Update Topic Country Chart based on selected country
function updateTopicCountryChart() {
    const selectedCountry = document.getElementById('countryFilter').value;
    const topics = countryData[selectedCountry] || {};

    topicCountryChart.data.labels = Object.keys(topics);
    topicCountryChart.data.datasets[0].data = Object.values(topics);
    topicCountryChart.update();
}

// Initialize Topic Year Chart
function initializeTopicYearChart() {
    const ctx = document.getElementById('topicYearChart').getContext('2d');
    topicYearChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [], // Filled in update function
            datasets: [{
                label: 'Topic Clusters by Year',
                data: [],
                backgroundColor: 'rgba(153, 102, 255, 0.2)',
                borderColor: 'rgba(153, 102, 255, 1)',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Update Topic Year Chart based on selected year
function updateTopicYearChart() {
    const selectedYear = document.getElementById('yearFilter').value;
    const topics = yearData[selectedYear] || {};

    topicYearChart.data.labels = Object.keys(topics);
    topicYearChart.data.datasets[0].data = Object.values(topics);
    topicYearChart.update();
}
