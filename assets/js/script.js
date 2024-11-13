mapboxgl.accessToken = 'pk.eyJ1IjoicGVpc2thc3NpbyIsImEiOiJjbTM4eHB5NHIwd2M5MmlxeGlsOTRqams5In0.hEmqLEzaR2kWC2s7Hgd-Ng';

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v10', //mapbox://styles/peiskassio/cm38wege300j601pd4oe2f3re
    center: [0, 0],
    zoom: 1.5,
    projection: 'globe'
});

mapboxgl.accessToken = 'pk.eyJ1IjoicGVpc2thc3NpbyIsImEiOiJjbTM4eHB5NHIwd2M5MmlxeGlsOTRqams5In0.hEmqLEzaR2kWC2s7Hgd-Ng';

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v10', //mapbox://styles/peiskassio/cm38wege300j601pd4oe2f3re
    center: [0, 0],
    zoom: 1.5,
    projection: 'globe'
});

// Declare topicClusters in the global scope
let topicClusters;

map.on('style.load', () => {
    map.setFog({
        'range': [0.5, 10],
        'color': 'rgb(186, 210, 235)',
        'horizon-blend': 0.1
    });

    // Ensures the globe projection is activated if it’s not displaying properly initially
   // map.setProjection('globe');
});


map.on('load', async () => {
    try {
        const artworkResponse = await fetch('data/artwork-data.json');
        const artworkData = await artworkResponse.json();
        const topicClusterResponse = await fetch('topicClusters.json');
        topicClusters = await topicClusterResponse.json(); // Assign to global variable

        // Funktion, um die Farbe für ein Cluster basierend auf dem ersten Thema zu finden
        function getClusterColor(firstTopic) {
            for (const [cluster, data] of Object.entries(topicClusters)) {
                if (data.topics.includes(firstTopic)) {
                    return data.color; // Rückgabe der Farbe aus topicClusters.json
                }
            }
            return '#ffffff'; // Standardfarbe, falls kein Cluster gefunden wird
        }

        // Füge Farben zu den Kunstwerken basierend auf dem ersten Thema hinzu
        artworkData.features.forEach(feature => {
            const firstTopic = feature.properties.tags.topic?.[0]; // Nimm nur das erste Thema
            feature.properties.mainClusterColor = getClusterColor(firstTopic); // Farbe statt Cluster-ID speichern
        });

        // Füge die Quelle mit den modifizierten Kunstwerken hinzu
        map.addSource('artworks', {
            type: 'geojson',
            data: artworkData,
            cluster: true,
            clusterMaxZoom: 10,
            clusterRadius: 20
        });

        // Extrahiere alle einzigartigen Topics und Artforms
        const topics = new Set();
        const artforms = new Set();

        artworkData.features.forEach(feature => {
            if (feature.properties.tags) {
                feature.properties.tags.topic?.forEach(tag => topics.add(tag));
                feature.properties.tags.artform?.forEach(tag => artforms.add(tag));
            }
        });

        // Fülle das Topic Filter Dropdown
        const topicSelect = document.getElementById('tag-filter');
        topics.forEach(topic => {
            const option = document.createElement('option');
            option.value = topic;
            option.textContent = topic;
            topicSelect.appendChild(option);
        });

        // Fülle das Artform Filter Dropdown
        const artformSelect = document.getElementById('artform-filter');
        artforms.forEach(artform => {
            const option = document.createElement('option');
            option.value = artform;
            option.textContent = artform;
            artformSelect.appendChild(option);
        });

        // Fülle das Cluster Filter Dropdown mit farbigen Punkten und Cluster-Namen
        const clusterSelect = document.getElementById('cluster-filter');
        Object.entries(topicClusters).forEach(([clusterName, clusterData]) => {
            const option = document.createElement('option');
            option.value = clusterName;
            option.textContent = clusterName;
            option.style.color = clusterData.color; // Apply the color to the text instead of the background
            clusterSelect.appendChild(option);
        });

        // Definiere Cluster- und Unclustered-Layer
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
                    20, 
                    10, 30, 
                    20, 40
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
                'circle-color': ['get', 'mainClusterColor'], // Verwende die Farbe des Clusters hier
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


document.addEventListener('DOMContentLoaded', () => {
    // Add event listener to the Apply button
    document.getElementById('apply-filters').addEventListener('click', applyFilters);

}); 

// Apply Filters Function
function applyFilters() {
    const searchText = document.getElementById('search-bar').value.toLowerCase();
    const selectedTopics = Array.from(document.getElementById('tag-filter').selectedOptions).map(option => option.value);
    const selectedArtForms = Array.from(document.getElementById('artform-filter').selectedOptions).map(option => option.value);
    const selectedClusters = Array.from(document.getElementById('cluster-filter').selectedOptions).map(option => option.value);

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

    if (selectedClusters.length > 0) {
        const clusterColorConditions = selectedClusters.map(cluster => {
            const color = topicClusters[cluster]?.color || '#ffffff';
            return ['==', ['get', 'mainClusterColor'], color];
        });
        filter.push(['any', ...clusterColorConditions]);
    }

    if (selectedArtForms.length > 0) {
        filter.push([
            'any',
            ...selectedArtForms.map(artform => ['in', artform, ['get', 'artform']])
        ]);
    }

    // Apply filter to unclustered-point layer
    if (map.getLayer('unclustered-point')) {
        map.setFilter('unclustered-point', filter.length > 1 ? filter : null);
    }

    // Reset clusters layer filter to show all clusters
    if (map.getLayer('clusters')) {
        map.setFilter('clusters', null);
    }
}

// Add event listener to Apply button
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('apply-filters').addEventListener('click', applyFilters);
});
