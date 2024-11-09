mapboxgl.accessToken = 'pk.eyJ1IjoicGVpc2thc3NpbyIsImEiOiJjbTM4eHB5NHIwd2M5MmlxeGlsOTRqams5In0.hEmqLEzaR2kWC2s7Hgd-Ng';

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v10',
    center: [0, 0],
    zoom: 1.5,
    projection: 'globe'
});

// Optional: Customize globe settings for atmospheric effects
map.on('style.load', () => {
    map.setFog({
        'range': [0.5, 10],
        'color': 'rgb(186, 210, 235)',
        'horizon-blend': 0.1,
        'star-intensity': 0.15
    });
});

map.on('load', async () => {
    const response = await fetch('artwork-data.json');
    const data = await response.json();

    // Extrahiere einzigartige Tags für Topics und Artforms
    const topics = new Set();
    const artforms = new Set();

    data.features.forEach(feature => {
        feature.properties.tags.topic.forEach(tag => topics.add(tag));
        feature.properties.tags.artform.forEach(tag => artforms.add(tag));
    });

    // Fülle die Topic-Filter-Dropdown
    const topicSelect = document.getElementById('tag-filter');
    topics.forEach(topic => {
        const option = document.createElement('option');
        option.value = topic;
        option.textContent = topic;
        topicSelect.appendChild(option);
    });

    // Fülle die Artform-Filter-Dropdown
    const artformSelect = document.getElementById('artform-filter');
    artforms.forEach(artform => {
        const option = document.createElement('option');
        option.value = artform;
        option.textContent = artform;
        artformSelect.appendChild(option);
    });

    // Map Source und Layer hinzufügen
    map.addSource('artworks', {
        type: 'geojson',
        data: data,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50
    });

    // Cluster-Layer
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

    // Cluster-Anzahl anzeigen
    map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'artworks',
        filter: ['has', 'point_count'],
        layout: {
            'text-field': '{point_count_abbreviated}',
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            'text-size': 12
        }
    });

    // Ungeclusterte Punkte für einzelne Kunstwerke
    map.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: 'artworks',
        filter: ['!', ['has', 'point_count']],
        paint: {
            'circle-color': '#f28cb1',
            'circle-radius': 10,
            'circle-stroke-width': 1,
            'circle-stroke-color': '#fff'
        }
    });

    // Popup für einzelne Punkte
    map.on('click', 'unclustered-point', (e) => {
        const coordinates = e.features[0].geometry.coordinates.slice();
        const { title, description, artist, year } = e.features[0].properties;

        new mapboxgl.Popup()
            .setLngLat(coordinates)
            .setHTML(`
                <h3>${title}</h3>
                <p><strong>Artist:</strong> ${artist}</p>
                <p><strong>Description:</strong> ${description}</p>
                <p><strong>Year:</strong> ${year}</p>
            `)
            .addTo(map);
    });

    // Klick auf Cluster zum Zoomen
    map.on('click', 'clusters', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        const clusterId = features[0].properties.cluster_id;
        map.getSource('artworks').getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err) return;
            map.easeTo({ center: features[0].geometry.coordinates, zoom });
        });
    });

    // Mauszeiger ändern bei Hover
    map.on('mouseenter', 'clusters', () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseleave', 'clusters', () => map.getCanvas().style.cursor = '');
    map.on('mouseenter', 'unclustered-point', () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseleave', 'unclustered-point', () => map.getCanvas().style.cursor = '');

    // Event Listener für Filter und Suche
    document.getElementById('search-bar').addEventListener('input', applyFilters);
    document.getElementById('tag-filter').addEventListener('change', applyFilters);
    document.getElementById('artform-filter').addEventListener('change', applyFilters);
});

// Filter-Funktion außerhalb des `map.on('load', ...)` Blocks
function applyFilters() {
    const searchText = document.getElementById('search-bar').value.toLowerCase();
    const selectedTopic = document.getElementById('tag-filter').value;
    const selectedArtForm = document.getElementById('artform-filter').value;

    const filter = ['all'];

    // Suche nach Titel oder Beschreibung
    if (searchText) {
        filter.push([
            'any',
            ['match', ['to-lower', ['get', 'title']], [searchText], true, false],
            ['match', ['to-lower', ['get', 'description']], [searchText], true, false]
        ]);
    }

    // Filtern nach Topic
    if (selectedTopic) {
        filter.push(['in', selectedTopic, ['get', 'tags', 'topic']]);
    }

    // Filtern nach Artform
    if (selectedArtForm) {
        filter.push(['in', selectedArtForm, ['get', 'tags', 'artform']]);
    }

    // Filter anwenden
    map.setFilter('unclustered-point', filter.length > 1 ? filter : null);
}
