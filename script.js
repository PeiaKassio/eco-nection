mapboxgl.accessToken = 'pk.eyJ1IjoicGVpc2thc3NpbyIsImEiOiJjbTM4dnF4amEwbXB2MmtyMTNvM2h6M3M4In0.lMQxgMaKvSoleeld1DLOsA';

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v11', <!--mapbox://styles/peiskassio/cm38wege300j601pd4oe2f3re -->
    center: [10.0, 50.0], // Center coordinates [longitude, latitude]
    zoom: 5 // Starting zoom level
});

map.on('load', () => {
    // Add a new source from your GeoJSON data and enable clustering
    map.addSource('artworks', {
        type: 'geojson',
        data: 'artwork-data.json', // Path to your GeoJSON file
        cluster: true,
        clusterMaxZoom: 14, // Max zoom to cluster points
        clusterRadius: 50 // Radius of each cluster when clustering points (in pixels)
    });

    // Create clustered circle layer
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

    // Cluster count labels
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

    // Individual artwork points
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

    // Click event to display artwork details on click
    map.on('click', 'unclustered-point', (e) => {
        const coordinates = e.features[0].geometry.coordinates.slice();
        const { title, description, artist } = e.features[0].properties;

        new mapboxgl.Popup()
            .setLngLat(coordinates)
            .setHTML(
                `<h3>${title}</h3><p><strong>Artist:</strong> ${artist}</p><p>${description}</p>`
            )
            .addTo(map);
    });

    // Zoom into cluster on click
    map.on('click', 'clusters', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        const clusterId = features[0].properties.cluster_id;
        map.getSource('artworks').getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err) return;
            map.easeTo({ center: features[0].geometry.coordinates, zoom });
        });
    });

    // Change cursor to pointer when hovering over clusters and points
    map.on('mouseenter', 'clusters', () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseleave', 'clusters', () => map.getCanvas().style.cursor = '');
    map.on('mouseenter', 'unclustered-point', () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseleave', 'unclustered-point', () => map.getCanvas().style.cursor = '');
});
