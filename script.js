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
    try {
        const artworkResponse = await fetch('artwork-data.json');
        const artworkData = await artworkResponse.json();
        const topicClusterResponse = await fetch('topicClusters.json');
        const topicClusters = await topicClusterResponse.json();

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
            option.value = clusterData.color; // Der Farbwert wird als Wert verwendet
            option.innerHTML = `<span style="color:${clusterData.color}; font-weight: bold;">●</span> ${clusterName}`;
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
                    <h3>${title}</h3>
                    <p><strong>Artist:</strong> ${artist}</p>
                    <p><strong>Description:</strong> ${description}</p>
                    <p><strong>Year:</strong> ${year}</p>
                    <p><strong>Topics:</strong> ${popupTopics}</p>
                    <p><strong>Art Forms:</strong> ${popupArtforms}</p>
                `)
                .addTo(map);
        });
    } catch (error) {
        console.error("Error loading data:", error);
    }
});

// Filterfunktion
function applyFilters() {
    const searchText = document.getElementById('search-bar').value.toLowerCase();
    const selectedTopic = document.getElementById('tag-filter').value;
    const selectedArtForm = document.getElementById('artform-filter').value;
    const selectedCluster = document.getElementById('cluster-filter').value;

    const filter = ['all'];

    if (searchText) {
        filter.push([
            'any',
            ['match', ['downcase', ['get', 'title']], [searchText], true, false],
            ['match', ['downcase', ['get', 'description']], [searchText], true, false]
        ]);
    }

    if (selectedTopic) {
        filter.push(['in', selectedTopic, ['get', ['get', 'tags'], 'topic']]);
    }

    if (selectedCluster) {
        filter.push(['==', ['get', 'mainClusterColor'], selectedCluster]);
    }

    if (selectedArtForm) {
        filter.push(['in', selectedArtForm, ['get', ['get', 'tags'], 'artform']]);
    }

    map.setFilter('unclustered-point', filter.length > 1 ? filter : null);

    if (map.getLayer('clusters')) {
        map.setFilter('clusters', filter.length > 1 ? ['==', 'point_count', 0] : null);
    }
}

document.getElementById('search-bar').addEventListener('input', applyFilters);
document.getElementById('tag-filter').addEventListener('change', applyFilters);
document.getElementById('artform-filter').addEventListener('change', applyFilters);
document.getElementById('cluster-filter').addEventListener('change', applyFilters);
