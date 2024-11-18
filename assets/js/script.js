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

        // Define cluster layer (all clusters will use #51bbd6)
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

        // Define unclustered-point layer (uses mainClusterColor for color)
        map.addLayer({
            id: 'unclustered-point',
            type: 'circle',
            source: 'artworks',
            filter: ['!', ['has', 'point_count']],
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
                    <div class="card bg-neutral shadow-xl -m-5">
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

    // Populate the Topic Filter Dropdown
    const topicSelect = document.getElementById('tag-filter');
    topicSelect.innerHTML = ''; // Clear existing options
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

    // Populate the Artform Filter Dropdown
    const artformSelect = document.getElementById('artform-filter');
    artformSelect.innerHTML = ''; // Clear existing options
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

    // Populate the Cluster Filter Dropdown with colors
    const clusterSelect = document.getElementById('cluster-filter');
    clusterSelect.innerHTML = ''; // Clear existing options
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

    console.log("Filter dropdowns populated with topics, art forms, and clusters."); // Debug output
}

// Apply Filters Function
function applyFilters() {
    const searchText = document.getElementById('search-bar').value.toLowerCase();
    const selectedTopics = Array.from(document.getElementById('tag-filter').selectedOptions).map(option => option.value).filter(value => value);
    const selectedArtForms = Array.from(document.getElementById('artform-filter').selectedOptions).map(option => option.value).filter(value => value);
    const selectedClusters = Array.from(document.getElementById('cluster-filter').selectedOptions).map(option => option.value).filter(value => value);

    const filter = ['all'];

    // If no filter is selected, reset to show all points
    const noFilterSelected = !searchText && selectedTopics.length === 0 && selectedArtForms.length === 0 && selectedClusters.length === 0;

    if (noFilterSelected) {
        map.setFilter('unclustered-point', null); // Reset filter to show all points with color
        console.log("Resetting filter to show all points."); // Debugging output
        return;
    }

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

    // Apply clusters filter based on mainClusterColor
    if (selectedClusters.length > 0) {
        const clusterColorConditions = selectedClusters.map(cluster => {
            const color = topicClusters[cluster]?.color || '#ffffff';
            return ['==', ['get', 'mainClusterColor'], color];
        });
        filter.push(['any', ...clusterColorConditions]);
    }

    // Apply art forms filter
    if (selectedArtForms.length > 0) {
        filter.push([
            'any',
            ...selectedArtForms.map(artform => ['in', artform, ['get', 'artform']])
        ]);
    }

    console.log("Applying filter:", filter); // Debugging output for the filter

    // Apply filter only to the unclustered-point layer
    if (map.getLayer('unclustered-point')) {
        map.setFilter('unclustered-point', filter.length > 1 ? filter : null);
    }

    // Ensure clusters layer shows all clusters (no filters applied)
    if (map.getLayer('clusters')) {
        map.setFilter('clusters', null);
    }
}

// Add event listener to Apply button
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('apply-filters').addEventListener('click', applyFilters);
});
