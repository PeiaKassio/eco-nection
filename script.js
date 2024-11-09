mapboxgl.accessToken = 'pk.eyJ1IjoicGVpc2thc3NpbyIsImEiOiJjbTM4eHB5NHIwd2M5MmlxeGlsOTRqams5In0.hEmqLEzaR2kWC2s7Hgd-Ng';

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v10',
    center: [0, 0],
    zoom: 1.5,
    projection: 'globe'
});

map.on('style.load', () => {
    map.setFog({
        'range': [0.5, 10],
        'color': 'rgb(186, 210, 235)',
        'horizon-blend': 0.1
    });
});

map.on('load', async () => {
    const artworkResponse = await fetch('artwork-data.json');
    const artworkData = await artworkResponse.json();
    const topicClusterResponse = await fetch('topicClusters.json');
    const topicClusters = await topicClusterResponse.json();

    // Function to get color based on main topic cluster
    function getClusterColor(topics) {
        for (const [cluster, data] of Object.entries(topicClusters)) {
            if (topics.some(topic => data.topics.includes(topic))) {
                return data.color;
            }
        }
        return "#FFFFFF"; // Default color if no cluster matches
    }

    // Add colors to artwork features based on main cluster
    artworkData.features.forEach(feature => {
        const mainTopics = feature.properties.tags.topic || [];
        feature.properties.mainClusterColor = getClusterColor(mainTopics);
    });

    // Add source with modified artwork data
    map.addSource('artworks', {
        type: 'geojson',
        data: artworkData,
        cluster: true,
        clusterMaxZoom: 10,
        clusterRadius: 20
    });

    // Populate unique tags for topics and artforms
    const topics = new Set();
    const artforms = new Set();

    artworkData.features.forEach(feature => {
        if (feature.properties.tags) {
            if (feature.properties.tags.topic) {
                feature.properties.tags.topic.forEach(tag => topics.add(tag));
            }
            if (feature.properties.tags.artform) {
                feature.properties.tags.artform.forEach(tag => artforms.add(tag));
            }
        }
    });

    // Fill the Topic filter dropdown
    const topicSelect = document.getElementById('tag-filter');
    topics.forEach(topic => {
        const option = document.createElement('option');
        option.value = topic;
        option.textContent = topic;
        topicSelect.appendChild(option);
    });

    // Fill the Artform filter dropdown
    const artformSelect = document.getElementById('artform-filter');
    artforms.forEach(artform => {
        const option = document.createElement('option');
        option.value = artform;
        option.textContent = artform;
        artformSelect.appendChild(option);
    });

    // Define cluster and unclustered layers
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
                20, 10,
                30, 20,
                40, 30
            ],
            'circle-opacity': 0.6
        }
    });

    map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'artworks',
        filter: ['has', 'point_count'],
        layout: {
            'text-field': '{point_count_abbreviated}',
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            'text-size': 12
        },
        paint: {
            'text-color': '#ffffff'
        }
    });

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

    map.on('click', 'unclustered-point', (e) => {
        const coordinates = e.features[0].geometry.coordinates.slice();
        const properties = e.features[0].properties || {};

        const title = properties.title || 'Untitled';
        const description = properties.description || 'No Description';
        const artist = properties.artist || 'Unknown';
        const year = properties.year || 'Unknown';

        // Access topics and artforms as comma-separated strings
        const popupTopics = Array.isArray(properties.tags.topic) ? properties.tags.topic.join(', ') : 'No Topics';
        const popupArtforms = Array.isArray(properties.tags.artform) ? properties.tags.artform.join(', ') : 'No Art Forms';

        new mapboxgl.Popup()
            .setLngLat(coordinates)
            .setHTML(`
                <h3>${title}</h3>
                <p><strong>Artist:</strong> ${artist}</p>
                <p><strong>Description:</strong> ${description}</p>
                <p><strong>Year:</strong> ${year}</p>
                <p><strong>Topics:</strong> ${popupTopics}</p>
                <p><strong>Art Forms:</strong> ${popupArtforms}</p>
            `)
            .addTo(map);
    });
});

// Filter function
function applyFilters() {
    const searchText = document.getElementById('search-bar').value.toLowerCase();
    const selectedTopic = document.getElementById('tag-filter').value;
    const selectedArtForm = document.getElementById('artform-filter').value;

    const filter = ['all'];

    if (searchText) {
        filter.push([
            'any',
            ['match', ['downcase', ['get', 'title']], [searchText], true, false],
            ['match', ['downcase', ['get', 'description']], [searchText], true, false]
        ]);
    }

    if (selectedTopic) {
        filter.push(['in', selectedTopic, ['get', 'topic', ['get', 'tags']]]);
    }

    if (selectedArtForm) {
        filter.push(['in', selectedArtForm, ['get', 'artform', ['get', 'tags']]]);
    }

    map.setFilter('unclustered-point', filter.length > 1 ? filter : null);

    // Hide clusters if a filter is active
    if (map.getLayer('clusters')) {
        map.setFilter('clusters', filter.length > 1 ? ['==', 'point_count', 0] : null);
    }
}

document.getElementById('search-bar').addEventListener('input', applyFilters);
document.getElementById('tag-filter').addEventListener('change', applyFilters);
document.getElementById('artform-filter').addEventListener('change', applyFilters);
