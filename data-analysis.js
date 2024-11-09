// Load and process the data
async function loadData() {
    try {
        const response = await fetch('artwork-data.json');
        const data = await response.json();
        console.log('Loaded data:', data); // Confirm data load

        const tagsByCountry = {};
        const focusShiftByYear = {};

        data.features.forEach((feature) => {
            const location = feature.properties.location;
            const country = location.split(', ').pop();
            const topics = feature.properties.tags.topic || [];
            const year = feature.properties.year || "Unknown";

            console.log(`Processing ${country} for year ${year}`);

            // Count topics by country
            if (!tagsByCountry[country]) tagsByCountry[country] = {};
            topics.forEach(topic => {
                tagsByCountry[country][topic] = (tagsByCountry[country][topic] || 0) + 1;
            });

            // Track environmental focus shift over time by year
            if (!focusShiftByYear[year]) focusShiftByYear[year] = {};
            topics.forEach(topic => {
                focusShiftByYear[year][topic] = (focusShiftByYear[year][topic] || 0) + 1;
            });
        });

        console.log('Tags by Country:', tagsByCountry);
        console.log('Focus Shift Over Time by Year:', focusShiftByYear);

        // Generate the charts
        createTagsByCountryChart(tagsByCountry);
        createFocusShiftOverTimeChart(focusShiftByYear);
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

// Create line chart for environmental focus shift over time by year
function createFocusShiftOverTimeChart(data) {
    const ctx = document.getElementById('focusShiftOverTimeChart').getContext('2d');
    const years = Object.keys(data);
    const tags = [...new Set(years.flatMap(year => Object.keys(data[year])))];

    const datasets = tags.map(tag => ({
        label: tag,
        data: years.map(year => data[year][tag] || 0),
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
                    text: 'Environmental Focus Shift Over Time by Year'
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
 
