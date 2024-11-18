mapboxgl.accessToken = 'pk.eyJ1IjoicGVpc2thc3NpbyIsImEiOiJjbTM4eHB5NHIwd2M5MmlxeGlsOTRqams5In0.hEmqLEzaR2kWC2s7Hgd-Ng';

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v10',
    center: [0, 0],
    zoom: 1.5,
    projection: 'globe'
});

let topicClusters; // Declare topicClusters globally
let artworkData; // Declare artworkData globally

map.on('style.load', () => {
    map.setFog({
        'range': [0.5, 10],
        'color': 'rgb(186, 210, 235)',
        'horizon-blend': 0.1
    });
});

map.on('load', async () => {
    try {
        // Fetch data asynchronously
        const artworkResponse = await fetch('data/artwork-data.json');
        artworkData = await artworkResponse.json(); // Initialize artworkData globally
        console.log("Artwork Data Loaded:", artworkData.features); // Log artworkData after it's loaded

        const topicClusterResponse = await fetch('topicClusters.json');
        topicClusters = await topicClusterResponse.json();

        // Assign colors to artworks based on topics
        function getClusterColor(firstTopic) {
            for (const [cluster, data] of Object.entries(topicClusters)) {
                if (data.topics.includes(firstTopic)) {
                    return data.color;
                }
            }
            return '#ffffff'; // Default color if no cluster is found
        }

        artworkData.features.forEach(feature => {
            const firstTopic = feature.properties.tags.topic?.[0];
            feature.properties.mainClusterColor = getClusterColor(firstTopic) || '#ffffff';
        });

        // Populate filter dropdowns
        populateFilterDropdowns(artworkData, topicClusters);

        // Add source for the map
        map.addSource('artworks', {
            type: 'geojson',
            data: artworkData
        });

        // Add unclustered-point layer
        map.addLayer({
            id: 'unclustered-point',
            type: 'circle',
            source: 'artworks',
            paint: {
                'circle-color': ['get', 'mainClusterColor'],
                'circle-radius': 10,
                'circle-stroke-width': 1,
                'circle-stroke-color': '#fff'
            }
        });

        // Add popup on click
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

// Function to populate filter dropdowns
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
    topicSelect.innerHTML = '<option value="">All Topics</option>';
    topics.forEach(topic => {
        const option = document.createElement('option');
        option.value = topic;
        option.textContent = topic;
        topicSelect.appendChild(option);
    });

    const artformSelect = document.getElementById('artform-filter');
    artformSelect.innerHTML = '<option value="">All Art Forms</option>';
    artforms.forEach(artform => {
        const option = document.createElement('option');
        option.value = artform;
        option.textContent = artform;
        artformSelect.appendChild(option);
    });

    const clusterSelect = document.getElementById('cluster-filter');
    clusterSelect.innerHTML = '<option value="">All Clusters</option>';
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
    if (!artworkData) {
        console.error("Artwork data is not loaded yet.");
        return;
    }

    const searchText = document.getElementById('search-bar').value.toLowerCase();
    const selectedTopics = Array.from(document.getElementById('tag-filter').selectedOptions)
        .map(option => option.value)
        .filter(value => value);
    const selectedArtForms = Array.from(document.getElementById('artform-filter').selectedOptions)
        .map(option => option.value)
        .filter(value => value);

    const filter = ['all'];

    if (searchText) {
        filter.push([
            'any',
            ['>=', ['index-of', searchText, ['downcase', ['get', 'title']]], 0],
            ['>=', ['index-of', searchText, ['downcase', ['get', 'description']]], 0]
        ]);
    }

    if (selectedTopics.length > 0) {
        filter.push([
            'any',
            ...selectedTopics.map(topic => ['>=', ['index-of', topic, ['get', 'tags.topic']], 0])
        ]);
    }

    if (selectedArtForms.length > 0) {
        filter.push([
            'any',
            ...selectedArtForms.map(artform => ['>=', ['index-of', artform, ['get', 'tags.artform']], 0])
        ]);
    }

    if (map.getLayer('unclustered-point')) {
        map.setFilter('unclustered-point', filter.length > 1 ? filter : null);
    }
}

// Event listeners for filters
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
