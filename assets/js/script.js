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
                'circle-color': '#51bbd6', // Color for clusters
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

    } catch (error) {
        console.error("Error loading data:", error);
    }
});

// Apply Filters Function
function applyFilters() {
    const searchText = document.getElementById('search-bar').value.toLowerCase();
    const selectedTopics = Array.from(document.getElementById('tag-filter').selectedOptions).map(option => option.value);
    const selectedArtForms = Array.from(document.getElementById('artform-filter').selectedOptions).map(option => option.value);
    const selectedClusters = Array.from(document.getElementById('cluster-filter').selectedOptions).map(option => option.value);

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
