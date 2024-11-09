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
        data: 'artwork-data.json',
        cluster: true,
        clusterMaxZoom: 10,
        clusterRadius: 20
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
    },
    paint: {
        'text-color': '#ffffff' // Set to white or another contrasting color
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
    const properties = e.features[0].properties || {};

    // Debugging logs
    console.log("Properties:", properties);
    console.log("Tags:", properties.tags);

    const title = properties.title || 'Untitled';
    const description = properties.description || 'No Description';
    const artist = properties.artist || 'Unknown';
    const year = properties.year || 'Unknown';

    // Safely access topics and artforms
    const topics = properties.tags && properties.tags.topic ? properties.tags.topic.join(', ') : 'No Topics';
    const artforms = properties.tags && properties.tags.artform ? properties.tags.artform.join(', ') : 'No Art Forms';

    console.log("Topics:", topics);  // Should output actual topics if present
    console.log("Art Forms:", artforms);  // Should output actual art forms if present

    new mapboxgl.Popup()
        .setLngLat(coordinates)
        .setHTML(`
            <h3>${title}</h3>
            <p><strong>Artist:</strong> ${artist}</p>
            <p><strong>Description:</strong> ${description}</p>
            <p><strong>Year:</strong> ${year}</p>
            <p><strong>Topics:</strong> ${topics}</p>
            <p><strong>Art Forms:</strong> ${artforms}</p>
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

function applyFilters() {
    const searchText = document.getElementById('search-bar').value.toLowerCase();
    const selectedTopic = document.getElementById('tag-filter').value;
    const selectedArtForm = document.getElementById('artform-filter').value;

    const filter = ['all'];

    // Add search text filter if there's text in the search bar
    if (searchText) {
        filter.push([
            'any',
            ['match', ['to-lower', ['get', 'title']], [searchText], true, false],
            ['match', ['to-lower', ['get', 'description']], [searchText], true, false]
        ]);
    }

    // Apply topic filter by correctly accessing `tags.topic`
    if (selectedTopic) {
        filter.push(['in', selectedTopic, ['get', ['get', 'tags'], 'topic']]);
    }

    // Apply art form filter by correctly accessing `tags.artform`
    if (selectedArtForm) {
        filter.push(['in', selectedArtForm, ['get', ['get', 'tags'], 'artform']]);
    }

    // Log the constructed filter for debugging
    console.log("Applying filter:", JSON.stringify(filter));

    // Apply the filter to the map layer
    map.setFilter('unclustered-point', filter.length > 1 ? filter : null);
}

// Add an event listener to the "Apply" button
document.getElementById('apply-filters').addEventListener('click', applyFilters);
