document.addEventListener('DOMContentLoaded', async () => {
    const continentFilter = document.getElementById('continentFilter');
    const countryFilter = document.getElementById('countryFilter');
    const topicCountryChartCanvas = document.getElementById('topicCountryChart').getContext('2d');
    const topicYearChartCanvas = document.getElementById('topicYearChart').getContext('2d');
    const artFormTopicChartCanvas = document.getElementById('artFormTopicChart').getContext('2d');

    let artworkData, continentMapping, topicClusters;
    let topicCountryChart, topicYearChart, artFormTopicChart;

    // Load data
    try {
        const artworkResponse = await fetch('artwork-data.json');
        artworkData = await artworkResponse.json();
        continentMapping = await loadContinentMapping();
        topicClusters = await fetch('topicClusters.json').then(res => res.json());

        // Initialize chart setup
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

    // Populate country filter based on selected continent
    function populateCountryFilter() {
        const selectedContinent = continentFilter.value;
        countryFilter.innerHTML = '';
        if (selectedContinent && continentMapping[selectedContinent]) {
            continentMapping[selectedContinent].forEach(country => {
                const option = document.createElement('option');
                option.value = country;
                option.textContent = country;
                countryFilter.appendChild(option);
            });
        }
    }

    // Page 1: Update Topic Cluster by Country chart
    function updateTopicCountryChart() {
        const selectedContinent = continentFilter.value;
        const selectedCountries = Array.from(countryFilter.selectedOptions).map(option => option.value);

        const filteredData = artworkData.features.filter(feature => {
            const country = feature.properties.location.split(', ').pop();
            const continent = getContinent(country);
            return (!selectedContinent || continent === selectedContinent) && 
                   (selectedCountries.length === 0 || selectedCountries.includes(country));
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
            backgroundColor: 'rgba(54, 162, 235, 0.6)',
        }];
        topicCountryChart.update();
    }

    // Page 2: Topic Cluster by Year
    function updateTopicYearChart() {
        const minYear = Math.min(...artworkData.features.map(feature => feature.properties.year));
        const maxYear = Math.max(...artworkData.features.map(feature => feature.properties.year));

        const yearlyTopicCounts = {};
        for (let year = minYear; year <= maxYear; year++) {
            const yearData = artworkData.features.filter(feature => feature.properties.year === year);
            const topicCounts = {};

            yearData.forEach(feature => {
                const topic = feature.properties.tags.topic[0];
                topicCounts[topic] = (topicCounts[topic] || 0) + 1;
            });

            yearlyTopicCounts[year] = topicCounts;
        }

        topicYearChart.data.labels = Object.keys(yearlyTopicCounts);
        topicYearChart.data.datasets = Object.keys(topicClusters).map(cluster => ({
            label: cluster,
            data: Object.keys(yearlyTopicCounts).map(year => yearlyTopicCounts[year][cluster] || 0),
            backgroundColor: topicClusters[cluster].color
        }));

        topicYearChart.update();
    }

    // Page 3: Art Form vs Topic Clusters
    function updateArtFormTopicChart() {
        const artFormTopicCounts = {};

        artworkData.features.forEach(feature => {
            const artForms = feature.properties.tags.artform;
            const topic = feature.properties.tags.topic[0];

            artForms.forEach(artForm => {
                if (!artFormTopicCounts[artForm]) {
                    artFormTopicCounts[artForm] = {};
                }
                artFormTopicCounts[artForm][topic] = (artFormTopicCounts[artForm][topic] || 0) + 1;
            });
        });

        const artForms = Object.keys(artFormTopicCounts);
        const topics = [...new Set(artForms.flatMap(artForm => Object.keys(artFormTopicCounts[artForm])))];

        artFormTopicChart.data.labels = topics;
        artFormTopicChart.data.datasets = artForms.map(artForm => ({
            label: artForm,
            data: topics.map(topic => artFormTopicCounts[artForm][topic] || 0),
            backgroundColor: `#${Math.floor(Math.random() * 16777215).toString(16)}`
        }));
        artFormTopicChart.update();
    }

    // Get continent based on country
    function getContinent(country) {
        for (const [continent, countries] of Object.entries(continentMapping)) {
            if (countries.includes(country)) {
                return continent;
            }
        }
        return null;
    }

    // Toggle analysis sections
    window.showAnalysis = function (section) {
        document.getElementById('topicCountryAnalysis').style.display = section === 'topicCountry' ? 'block' : 'none';
        document.getElementById('topicYearAnalysis').style.display = section === 'topicYear' ? 'block' : 'none';
        document.getElementById('artFormTopicAnalysis').style.display = section === 'artFormTopic' ? 'block' : 'none';
    };
});
