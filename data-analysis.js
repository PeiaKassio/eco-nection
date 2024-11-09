document.addEventListener('DOMContentLoaded', async () => {
    const continentFilter = document.getElementById('continentFilter');
    const countryFilter = document.getElementById('countryFilter');
    const topicCountryChartCanvas = document.getElementById('topicCountryChart').getContext('2d');
    const topicYearChartCanvas = document.getElementById('topicYearChart').getContext('2d');
    const artFormTopicChartCanvas = document.getElementById('artFormTopicChart').getContext('2d');

    let artworkData, continentMapping;
    let topicCountryChart, topicYearChart, artFormTopicChart;

    // Load artwork data and continent mapping
    try {
        const artworkResponse = await fetch('artwork-data.json');
        artworkData = await artworkResponse.json();
        continentMapping = await loadContinentMapping();

        populateContinentFilter();
        initTopicCountryChart();
        initTopicYearChart();
        initArtFormTopicChart();

        continentFilter.addEventListener('change', populateCountryFilter);

    } catch (error) {
        console.error("Error loading data:", error);
    }

    // Populate continent filter options
    function populateContinentFilter() {
        const continents = Object.keys(continentMapping);
        continents.forEach(continent => {
            const option = document.createElement('option');
            option.value = continent;
            option.textContent = continent;
            continentFilter.appendChild(option);
        });
    }

    // Populate country filter options based on selected continent
    function populateCountryFilter() {
        const selectedContinent = continentFilter.value;
        countryFilter.innerHTML = '<option value="">All Countries</option>';

        if (selectedContinent && continentMapping[selectedContinent]) {
            continentMapping[selectedContinent].forEach(country => {
                const option = document.createElement('option');
                option.value = country;
                option.textContent = country;
                countryFilter.appendChild(option);
            });
        }
    }

    // Initialize Topic Country Chart
    function initTopicCountryChart() {
        topicCountryChart = new Chart(topicCountryChartCanvas, {
            type: 'bar',
            data: { labels: [], datasets: [] },
            options: { responsive: true, scales: { x: { stacked: true }, y: { beginAtZero: true, stacked: true } } }
        });
        updateTopicCountryChart();
    }

    // Initialize Topic Year Chart
    function initTopicYearChart() {
        topicYearChart = new Chart(topicYearChartCanvas, {
            type: 'line',
            data: { labels: [], datasets: [] },
            options: { responsive: true, scales: { x: { type: 'linear', position: 'bottom' }, y: { beginAtZero: true } } }
        });
        updateTopicYearChart();
    }

    // Initialize Art Form Topic Chart
    function initArtFormTopicChart() {
        artFormTopicChart = new Chart(artFormTopicChartCanvas, {
            type: 'bar',
            data: { labels: [], datasets: [] },
            options: { responsive: true, scales: { x: { stacked: true }, y: { beginAtZero: true, stacked: true } } }
        });
        updateArtFormTopicChart();
    }

    // Update Topic Country Chart
    function updateTopicCountryChart() {
        const selectedContinent = continentFilter.value;
        const selectedCountry = countryFilter.value;

        const filteredData = artworkData.features.filter(feature => {
            const country = feature.properties.location.split(', ').pop();
            const continent = getContinent(country);
            return (!selectedContinent || continent === selectedContinent) && (!selectedCountry || country === selectedCountry);
        });

        const topicCounts = {};
        filteredData.forEach(feature => {
            const topic = feature.properties.tags.topic[0];
            topicCounts[topic] = (topicCounts[topic] || 0) + 1;
        });

        topicCountryChart.data.labels = Object.keys(topicCounts);
        topicCountryChart.data.datasets = [{
            label: 'Topic Frequency',
            data: Object.values(topicCounts),
            backgroundColor: 'rgba(54, 162, 235, 0.6)'
        }];
        topicCountryChart.update();
    }

    // Update Topic Year Chart
    function updateTopicYearChart() {
        const yearFilter = parseInt(document.getElementById('yearFilter').value, 10);

        const filteredData = artworkData.features.filter(feature => {
            const year = feature.properties.year;
            return !yearFilter || year === yearFilter;
        });

        const yearlyTopicCounts = {};
        filteredData.forEach(feature => {
            const year = feature.properties.year;
            yearlyTopicCounts[year] = (yearlyTopicCounts[year] || 0) + 1;
        });

        topicYearChart.data.labels = Object.keys(yearlyTopicCounts);
        topicYearChart.data.datasets = [{
            label: 'Topics by Year',
            data: Object.values(yearlyTopicCounts),
            borderColor: 'rgba(255, 99, 132, 0.6)',
            fill: false
        }];
        topicYearChart.update();
    }

    // Update Art Form Topic Chart
    function updateArtFormTopicChart() {
        const topicArtFormCounts = {};

        artworkData.features.forEach(feature => {
            const artForms = feature.properties.tags.artform;
            const topic = feature.properties.tags.topic[0];

            artForms.forEach(artForm => {
                if (!topicArtFormCounts[artForm]) {
                    topicArtFormCounts[artForm] = {};
                }
                topicArtFormCounts[artForm][topic] = (topicArtFormCounts[artForm][topic] || 0) + 1;
            });
        });

        const artForms = Object.keys(topicArtFormCounts);
        const topics = [...new Set(artForms.flatMap(artForm => Object.keys(topicArtFormCounts[artForm])))];

        artFormTopicChart.data.labels = topics;
        artFormTopicChart.data.datasets = artForms.map(artForm => ({
            label: artForm,
            data: topics.map(topic => topicArtFormCounts[artForm][topic] || 0),
            backgroundColor: `#${Math.floor(Math.random() * 16777215).toString(16)}` // Random color for each art form
        }));
        artFormTopicChart.update();
    }

    // Get continent for a country
    function getContinent(country) {
        for (const [continent, countries] of Object.entries(continentMapping)) {
            if (countries.includes(country)) {
                return continent;
            }
        }
        return null;
    }

    // Toggle analysis sections
    window.showAnalysis = function(section) {
        document.getElementById('topicCountryAnalysis').style.display = section === 'topicCountry' ? 'block' : 'none';
        document.getElementById('topicYearAnalysis').style.display = section === 'topicYear' ? 'block' : 'none';
        document.getElementById('artFormTopicAnalysis').style.display =
