// Load and analyze the data
async function loadData() {
    const response = await fetch('artwork-data.json');
    const data = await response.json();

    const tagsByCountry = {};
    const tagsByArtForm = {};

    data.features.forEach((feature) => {
        const country = feature.properties.location.split(', ').pop(); // Extract country from location
        const topics = feature.properties.tags.topic || [];
        const artforms = feature.properties.tags.artform || [];

        // Count tags by country
        if (!tagsByCountry[country]) tagsByCountry[country] = {};
        topics.forEach(tag => {
            tagsByCountry[country][tag] = (tagsByCountry[country][tag] || 0) + 1;
        });

        // Count tags by art form
        artforms.forEach(artform => {
            if (!tagsByArtForm[artform]) tagsByArtForm[artform] = {};
            topics.forEach(tag => {
                tagsByArtForm[artform][tag] = (tagsByArtForm[artform][tag] || 0) + 1;
            });
        });
    });

    // Generate the charts
    createTagsByCountryChart(tagsByCountry);
    createTagsByArtFormChart(tagsByArtForm);
}

// Create bar chart for tags by country
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
                    text: 'Most Common Tags by Country'
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

// Create bar chart for tags by art form
function createTagsByArtFormChart(data) {
    const ctx = document.getElementById('tagsByArtFormChart').getContext('2d');
    const artforms = Object.keys(data);
    const tags = [...new Set(artforms.flatMap(artform => Object.keys(data[artform])))];

    const datasets = tags.map(tag => ({
        label: tag,
        data: artforms.map(artform => data[artform][tag] || 0),
        backgroundColor: getRandomColor(),
    }));

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: artforms,
            datasets: datasets,
        },
        options: {
            plugins: {
                title: {
                    display: true,
                    text: 'Most Common Tags by Art Form'
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
