import { continentMapping } from './continentMapping.js';

let topicCountryChart, topicYearChart;

async function fetchData() {
    const response = await fetch('artwork-data.json');
    const artworkData = await response.json();

    const topicsByCountry = {};
    const topicsByYear = {};

    artworkData.features.forEach(feature => {
        const country = feature.properties.location.split(', ').pop();
        const year = feature.properties.year;
        const topics = feature.properties.tags.topic;

        if (!topicsByCountry[country]) topicsByCountry[country] = {};
        topics.forEach(topic => {
            topicsByCountry[country][topic] = (topicsByCountry[country][topic] || 0) + 1;
        });

        if (!topicsByYear[year]) topicsByYear[year] = {};
        topics.forEach(topic => {
            topicsByYear[year][topic] = (topicsByYear[year][topic] || 0) + 1;
        });
    });

    return { topicsByCountry, topicsByYear };
}

function populateCountryFilter(topicsByCountry) {
    const countryFilter = document.getElementById('countryFilter');
    Object.keys(topicsByCountry).forEach(country => {
        const option = document.createElement('option');
        option.value = country;
        option.textContent = country;
        countryFilter.appendChild(option);
    });
}

function showAnalysis(analysisType) {
    document.getElementById('topicCountryAnalysis').style.display = (analysisType === 'topicCountry') ? 'block' : 'none';
    document.getElementById('topicYearAnalysis').style.display = (analysisType === 'topicYear') ? 'block' : 'none';
}

function updateTopicCountryChart(topicsByCountry) {
    const country = document.getElementById('countryFilter').value;
    const continent = continentMapping[country] || "Unknown";
    const data = topicsByCountry[country] || {};

    if (topicCountryChart) topicCountryChart.destroy();

    topicCountryChart = new Chart(document.getElementById('topicCountryChart'), {
        type: 'bar',
        data: {
            labels: Object.keys(data),
            datasets: [{
                label: `Topic Clusters in ${country} (${continent})`,
                data: Object.values(data),
                backgroundColor: 'rgba(75, 192, 192, 0.6)'
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function updateTopicYearChart(topicsByYear) {
    const year = document.getElementById('yearFilter').value;
    const data = topicsByYear[year] || {};

    if (topicYearChart) topicYearChart.destroy();

    topicYearChart = new Chart(document.getElementById('topicYearChart'), {
        type: 'line',
        data: {
            labels: Object.keys(data),
            datasets: [{
                label: `Topic Clusters in ${year}`,
                data: Object.values(data),
                backgroundColor: 'rgba(153, 102, 255, 0.6)',
                borderColor: 'rgba(153, 102, 255, 1)',
                fill: false
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const { topicsByCountry, topicsByYear } = await fetchData();
    populateCountryFilter(topicsByCountry);

    document.getElementById('countryFilter').addEventListener('change', () => updateTopicCountryChart(topicsByCountry));
    document.getElementById('yearFilter').addEventListener('input', () => updateTopicYearChart(topicsByYear));
});
