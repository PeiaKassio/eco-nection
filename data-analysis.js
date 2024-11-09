import continentMapping from './continentMapping.js';

async function loadData() {
    try {
        const response = await fetch('artwork-data.json');
        const data = await response.json();
        console.log('Loaded data:', data); // Debugging line to check data

        const tagsByCountry = {};
        const tagsByContinent = {};
        const focusShiftByContinent = {};

        data.features.forEach((feature) => {
            const location = feature.properties.location;
            const country = location.split(', ').pop();
            const continent = continentMapping[country] || "Other";
            const topics = feature.properties.tags.topic || [];
            const year = feature.properties.year || "Unknown";

            // Count topics by country
            if (!tagsByCountry[country]) tagsByCountry[country] = {};
            topics.forEach(topic => {
                tagsByCountry[country][topic] = (tagsByCountry[country][topic] || 0) + 1;
            });

            // Count topics by continent
            if (!tagsByContinent[continent]) tagsByContinent[continent] = {};
            topics.forEach(topic => {
                tagsByContinent[continent][topic] = (tagsByContinent[continent][topic] || 0) + 1;
            });

            // Track environmental focus shift by continent over time
            if (!focusShiftByContinent[continent]) focusShiftByContinent[continent] = {};
            if (!focusShiftByContinent[continent][year]) focusShiftByContinent[continent][year] = {};
            topics.forEach(topic => {
                focusShiftByContinent[continent][year][topic] = 
                    (focusShiftByContinent[continent][year][topic] || 0) + 1;
            });
        });

        // Generate the charts
        createTagsByCountryChart(tagsByCountry);
        createTagsByContinentChart(tagsByContinent);
        createFocusShiftOverTimeChart(focusShiftByContinent);
    } catch (error) {
        console.error('Error loading or processing data:', error);
    }
}

// Create bar chart for topics by country
function createTagsByCountryChart(data) {
    const ctx = document.getElementById('tagsByCountryChart').getContext('2d');
    const countries = Object.keys(data);
    const tags = [...new Set(countries.flatMap(country => Object.keys(data[country])))];

    const datasets = tags.map(tag => ({
        label: tag,
        data: countries.map(country => data[country][tag] || 0),
        backgroundColor: getRandomColor(),
    }));

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: countries,
            datasets: datasets,
        },
        options: {
            plugins: {
                title: {
                    display: true,
                    text: 'Most Common Topic Tags by Country'
                },
            },
            responsive: true,
            scales: {
                x: { stacked: true },
                y: { beginAtZero: true, stacked: true },
            },
        }
    });
}

// Create bar chart for topics by continent
function createTagsByContinentChart(data) {
    const ctx = document.getElementById('tagsByContinentChart').getContext('2d');
    const continents = Object.keys(data);
    const tags = [...new Set(continents.flatMap(continent => Object.keys(data[continent])))];

    const datasets = tags.map(tag => ({
        label: tag,
        data: continents.map(continent => data[continent][tag] || 0),
        backgroundColor: getRandomColor(),
    }));

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: continents,
            datasets: datasets,
        },
        options: {
            plugins: {
                title: {
                    display: true,
                    text: 'Most Common Topic Tags by Continent'
                },
            },
            responsive: true,
            scales: {
                x: { stacked: true },
                y: { beginAtZero: true, stacked: true },
            },
        }
    });
}

// Create line chart for environmental focus shift over time by continent
function createFocusShiftOverTimeChart(data) {
    const ctx = document.getElementById('focusShiftOverTimeChart').getContext('2d');
    const continents = Object.keys(data);
    const years = [...new Set(continents.flatMap(continent => Object.keys(data[continent])))];
    const tags = [...new Set(
        continents.flatMap(continent => 
            Object.values(data[continent]).flatMap(yearData => Object.keys(yearData))
        )
    )];

    const datasets = tags.map(tag => ({
        label: tag,
        data: years.map(year => 
            continents.reduce((sum, continent) => 
                sum + (data[continent][year] ? (data[continent][year][tag] || 0) : 0), 0)
        ),
        borderColor: getRandomColor(),
        fill: false,
        tension: 0.1
    }));

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: years,
            datasets: datasets,
        },
        options: {
            plugins: {
                title: {
                    display: true,
                    text: 'Environmental Focus Shift Over Time by Continent'
                },
            },
            responsive: true,
            scales: {
                y: { beginAtZero: true },
            },
        }
    });
}

// Utility function to generate random colors for the chart
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

// Load data and create charts
loadData();
