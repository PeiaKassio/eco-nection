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

        // Add source with the artwork data (clusters disabled)
        map.addSource('artworks', {
            type: 'geojson',
            data: artworkData
        });

        // Define unclustered-point layer (uses mainClusterColor for color)
        map.addLayer({
            id: 'unclustered-point',
            type: 'circle',
            source: 'artworks',
            paint: {
                'circle-color': ['get', 'mainClusterColor'], // Use mainClusterColor property
                'circle-radius': 10,
                'circle-stroke-width': 1,
                'circle-stroke-color': '#fff'
            }
        });

        // Add popup on click for unclustered-point layer
        map.on('click', 'unclustered-point', (e) => {
            const coordinates = e.features[0].geometry.coordinates.slice();
            const properties = e.features[0].properties || {};

            const title = properties.title || 'Untitled';
            const description = properties.description || 'No Description';
            const artist = properties.artist || 'Unknown';
            const year = properties.year || 'Unknown';

            let tags = properties.tags;
            if (typeof tags === 'string') {
                try {
                    tags = JSON.parse(tags);
                } catch (error) {
                    console.error("Error parsing tags JSON:", error);
                    tags = {};
                }
            }

            const popupTopics = Array.isArray(tags.topic) ? tags.topic.join(', ') : 'No Topics';
            const popupArtforms = Array.isArray(tags.artform) ? tags.artform.join(', ') : 'No Art Forms';

            new mapboxgl.Popup()
                .setLngLat(coordinates)
                .setHTML(`
                    <div class="card bg-neutral shadow-xl -m-5 test-white">
                        <div class="card-body">
                            <h3 class="card-title">${title}</h3>
                            <p><strong>Artist:</strong> ${artist}</p>
                            <p><strong>Description:</strong> ${description}</p>
                            <p><strong>Year:</strong> ${year}</p>
                            <p><strong>Topics:</strong> ${popupTopics}</p>
                            <p><strong>Art Forms:</strong> ${popupArtforms}</p>
                        </div>
                    </div>
                `)
                .addTo(map);
        });
    } catch (error) {
        console.error("Error loading data:", error);
    }
});

// Function to populate filter dropdowns with unique topics, artforms, and clusters
function populateFilterDropdowns(artworkData, topicClusters) {
    const topics = new Set();
    const artforms = new Set();

    // Extract topics and art forms from artwork data
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
}

// Apply Filters Function
function applyFilters() {
    const searchText = document.getElementById('search-bar').value.toLowerCase();
    const selectedTopics = Array.from(document.getElementById('tag-filter').selectedOptions)
        .map(option => option.value)
        .filter(value => value);
    const selectedArtForms = Array.from(document.getElementById('artform-filter').selectedOptions)
        .map(option => option.value)
        .filter(value => value);

    const filter = ['all'];

    // Apply search text filter
    if (searchText) {
        filter.push([
            'any',
            ['match', ['downcase', ['get', 'title']], [searchText], true, false],
            ['match', ['downcase', ['get', 'description']], [searchText], true, false]
        ]);
    }

    // Apply topics filter
    if (selectedTopics.length > 0) {
        filter.push([
            'any',
            ...selectedTopics.map(topic => ['in', topic, ['get', 'topic']])
        ]);
    }

    // Apply art forms filter
    if (selectedArtForms.length > 0) {
        filter.push([
            'any',
            ...selectedArtForms.map(artform => ['in', artform, ['get', 'artform']])
        ]);
    }

    // Debug filter
    console.log("Applying filter:", filter);

    // Apply the filter
    if (map.getLayer('unclustered-point')) {
        if (filter.length > 1) {
            map.setFilter('unclustered-point', filter); // Apply the filter
        } else {
            map.setFilter('unclustered-point', null); // Reset to show all points
        }
    }

// Add event listeners for Apply and Reset buttons
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('apply-filters').addEventListener('click', applyFilters);

    document.getElementById('reset-filters').addEventListener('click', () => {
        document.getElementById('search-bar').value = '';
        document.getElementById('tag-filter').selectedIndex = 0;
        document.getElementById('artform-filter').selectedIndex = 0;
        document.getElementById('cluster-filter').selectedIndex = 0;
        applyFilters(); // Reset map to show all points
    });
});
