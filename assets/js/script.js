mapboxgl.accessToken = 'pk.eyJ1IjoicGVpc2thc3NpbyIsImEiOiJjbTM4eHB5NHIwd2M5MmlxeGlsOTRqams5In0.hEmqLEzaR2kWC2s7Hgd-Ng';

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v10',
    center: [0, 0],
    zoom: 1.5,
    projection: 'globe'
});

let topicClusters;

map.on('style.load', () => {
    map.setFog({
        'range': [0.5, 10],
        'color': 'rgb(186, 210, 235)',
        'horizon-blend': 0.1
    });
});

map.on('load', async () => {
    try {
        const artworkResponse = await fetch('data/artwork-data.json');
        const artworkData = await artworkResponse.json();
        const topicClusterResponse = await fetch('topicClusters.json');
        topicClusters = await topicClusterResponse.json();

        // Function to determine cluster color based on the first topic
        function getClusterColor(firstTopic) {
            for (const [cluster, data] of Object.entries(topicClusters)) {
                if (data.topics.includes(firstTopic)) {
                    return data.color;
                }
            }
            return '#ffffff'; // Default color if no cluster is found
        }

        // Assign a color to each artwork feature based on the first topic
        artworkData.features.forEach(feature => {
            const firstTopic = feature.properties.tags.topic?.[0];
            feature.properties.mainClusterColor = getClusterColor(firstTopic) || '#ffffff';
        });

        // Populate filter dropdowns
        populateFilterDropdowns(artworkData, topicClusters);

        // Add source with the artwork data
        map.addSource('artworks', {
            type: 'geojson',
            data: artworkData,
            cluster: true,
            clusterMaxZoom: 10,
            clusterRadius: 20
        });

        // Define cluster layer
        map.addLayer({
            id: 'clusters',
            type: 'circle',
            source: 'artworks',
            filter: ['has', 'point_count'],
            paint: {
                'circle-color': '#51bbd6',
                'circle-radius': [
                    'step',
                    ['get', 'point_count'],
                    20, 10, 30, 20, 40
                ],
                'circle-opacity': 0.6
            }
        });

        // Define unclustered-point layer
        map.addLayer({
            id: 'unclustered-point',
            type: 'circle',
            source: 'artworks',
            filter: ['!', ['has', 'point_count']],
            paint: {
                'circle-color': ['get', 'mainClusterColor'],
                'circle-radius': 10,
                'circle-stroke-width': 1,
                'circle-stroke-color': '#fff'
            }
        });

        console.log("Layers added successfully.");
    } catch (error) {
        console.error("Error loading data:", error);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const applyButton = document.getElementById('apply-filters');
    const resetButton = document.getElementById('reset-filters');

    applyButton.addEventListener('click', applyFilters);
    resetButton.addEventListener('click', () => {
        document.getElementById('search-bar').value = '';
        document.getElementById('tag-filter').selectedIndex = 0;
        document.getElementById('artform-filter').selectedIndex = 0;
        document.getElementById('cluster-filter').selectedIndex = 0;
        applyFilters(); // Reset the map
    });
});

function populateFilterDropdowns(artworkData, topicClusters) {
    const topics = new Set();
    const artforms = new Set();

    artworkData.features.forEach(feature => {
        if (feature.properties.tags) {
            feature.properties.tags.topic?.forEach(tag => topics.add(tag));
            feature.properties.tags.artform?.forEach(tag => artforms.add(tag));
        }
    });

    const topicSelect = document.getElementById('tag-filter');
    topicSelect.innerHTML = '';
    const allTopicsOption = document.createElement('option');
    allTopicsOption.value = '';
    allTopicsOption.textContent = 'All Topics';
    topicSelect.appendChild(allTopicsOption);

    topics.forEach(topic => {
        const option = document.createElement('option');
        option.value = topic;
        option.textContent = topic;
        topicSelect.appendChild(option);
    });

    const artformSelect = document.getElementById('artform-filter');
    artformSelect.innerHTML = '';
    const allArtformsOption = document.createElement('option');
    allArtformsOption.value = '';
    allArtformsOption.textContent = 'All Art Forms';
    artformSelect.appendChild(allArtformsOption);

    artforms.forEach(artform => {
        const option = document.createElement('option');
        option.value = artform;
        option.textContent = artform;
        artformSelect.appendChild(option);
    });

    const clusterSelect = document.getElementById('cluster-filter');
    clusterSelect.innerHTML = '';
    const allClustersOption = document.createElement('option');
    allClustersOption.value = '';
    allClustersOption.textContent = 'All Clusters';
    clusterSelect.appendChild(allClustersOption);

    Object.entries(topicClusters).forEach(([clusterName, clusterData]) => {
        const option = document.createElement('option');
        option.value = clusterName;
        option.textContent = clusterName;
        option.style.color = clusterData.color;
        clusterSelect.appendChild(option);
    });

    console.log("Dropdowns populated.");
}

function applyFilters() {
    const searchText = document.getElementById('search-bar').value.toLowerCase();
    const selectedTopics = Array.from(document.getElementById('tag-filter').selectedOptions).map(option => option.value).filter(value => value);
    const selectedArtForms = Array.from(document.getElementById('artform-filter').selectedOptions).map(option => option.value).filter(value => value);
    const selectedClusters = Array.from(document.getElementById('cluster-filter').selectedOptions).map(option => option.value).filter(value => value);

    const filter = ['all'];

    if (searchText) {
        filter.push([
            'any',
            ['match', ['downcase', ['get', 'title']], [searchText], true, false],
            ['match', ['downcase', ['get', 'description']], [searchText], true, false]
        ]);
    }

    if (selectedTopics.length > 0) {
        filter.push([
            'any',
            ...selectedTopics.map(topic => ['in', topic, ['get', 'topic']])
        ]);
    }

    if (selectedArtForms.length > 0) {
        filter.push([
            'any',
            ...selectedArtForms.map(artform => ['in', artform, ['get', 'artform']])
        ]);
    }

    if (selectedClusters.length > 0) {
        const clusterColorConditions = selectedClusters.map(cluster => {
            const color = topicClusters[cluster]?.color || '#ffffff';
            return ['==', ['get', 'mainClusterColor'], color];
        });
        filter.push(['any', ...clusterColorConditions]);
    }

    if (map.getLayer('unclustered-point')) {
        map.setFilter('unclustered-point', filter.length > 1 ? filter : null);
    }

    if (map.getLayer('clusters')) {
        map.setFilter('clusters', null);
    }
}
