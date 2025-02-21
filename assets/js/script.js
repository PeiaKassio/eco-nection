mapboxgl.accessToken = 'pk.eyJ1IjoicGVpc2thc3NpbyIsImEiOiJjbTM4eHB5NHIwd2M5MmlxeGlsOTRqams5In0.hEmqLEzaR2kWC2s7Hgd-Ng';

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v10',
    center: [0, 0],
    zoom: 1.5,
    projection: 'globe'
});

map.addControl(new mapboxgl.NavigationControl()); // Fügt die Zoomsteuerung hinzu

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
        const artworkResponse = await fetch('data/artwork-data.json');
        artworkData = await artworkResponse.json();
        console.log("Artwork Data Loaded:", artworkData.features);

// Index hinzufügen
artworkData.features.forEach((feature, i) => {
    if (!feature.properties) {
        feature.properties = {};
    }
    feature.properties.index = i;
});


        artworkCount = artworkData?.features?.length || 0 ;
        const countElement = document.getElementById('artwork-count');
        countElement.textContent = `Artwork Count: ${artworkCount}`;

        const topicClusterResponse = await fetch('data/topicClusters.json');
        topicClusters = await topicClusterResponse.json();
        console.log("Topic Clusters Loaded:", topicClusters);

        // Cluster-Farben definieren
            function getClusterColor(mainCluster) {
             return topicClusters[mainCluster]?.color || '#ffffff';
            }

        // ✅ mainCluster basierend auf topicClusters zuweisen
        artworkData.features.forEach(feature => {
            if (!feature.properties) return;

            // Finde das passende Topic-Cluster basierend auf den vorhandenen Topics
            feature.properties.mainCluster = Object.keys(topicClusters).find(cluster =>
                topicClusters[cluster].topics.some(topic => feature.properties.tags?.topic?.includes(topic))
            ) || 'Uncategorized';
        

        feature.properties.mainClusterColor = getClusterColor(feature.properties.mainCluster);
    });
        populateFilterDropdowns(artworkData, topicClusters);

            map.addSource('artworks', {
            type: 'geojson',
            data: artworkData,
            cluster: false,  // 🔹 Clustering aktivieren/deaktivieren
            //clusterMaxZoom: 1, // 🔹 Bis zu welchem Zoom Clustering aktiv ist
            //clusterRadius: 10  // 🔹 Abstand der Punkte innerhalb eines Clusters
        });

        // ✅ Cluster Layer (Zusammengefasste Punkte)
       // map.addLayer({
         //   id: 'clusters',
        // type: 'circle',
            //source: 'artworks',
            //filter: ['has', 'point_count'], // Zeige nur Cluster
            //paint: {
                //'circle-color': '#ff7300',
                //'circle-radius': ['step', ['get', 'point_count'], 15, 10, 25, 50, 35],
                //'circle-stroke-width': 1,
                //'circle-stroke-color': '#fff'
            //}
        //});

        // ✅ Cluster-Label (Zeigt die Anzahl der Punkte)
        //map.addLayer({
          //  id: 'cluster-count',
            //type: 'symbol',
            //source: 'artworks',
            //filter: ['has', 'point_count'],
            //layout: {
              //  'text-field': '{point_count_abbreviated}',
                //'text-size': 14,
                //'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold']
            //},
            //paint: {
              //  'text-color': '#fff'
            //}
        //});

        // ✅ Einzelne Punkte (die nicht mehr geclustert sind)
        map.addLayer({
            id: 'unclustered-point',
            type: 'circle',
            source: 'artworks',
            filter: ['!', ['has', 'point_count']], // Zeige nur Einzelpunkte
            paint: {
                'circle-color': ['get', 'mainClusterColor'],
                'circle-radius': 8,
                'circle-stroke-width': 1,
                'circle-stroke-color': '#fff', 
                'circle-translate': [
            'literal',
            [
                ['get', 'index'] % 2 === 0 ? 10 : -10, // X-Verschiebung: Jeder zweite Punkt wird um 10px versetzt
                ['get', 'index'] % 3 === 0 ? 10 : -10  // Y-Verschiebung: Jeder dritte Punkt wird um 10px versetzt
            ]
        ]
    }
        });

        // ✅ Klick-Event für Cluster: Zoom auf Cluster-Zentrum
        map.on('click', 'clusters', (e) => {
            const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
            const clusterId = features[0].properties.cluster_id;
            map.getSource('artworks').getClusterExpansionZoom(clusterId, (err, zoom) => {
                if (err) return;
                map.easeTo({
                    center: features[0].geometry.coordinates,
                    zoom: zoom
                });
            });
        });

        // ✅ Klick-Event für Einzelpunkte: Details anzeigen
        map.on('click', 'unclustered-point', (e) => {
            const properties = e.features[0].properties || {};
            const coordinates = e.features[0].geometry.coordinates.slice();
            const title = properties.title || 'Untitled';
            const description = properties.description || 'No Description';
            const artist = properties.artist || 'Unknown';
            const year = properties.year || 'Unknown';
            const url = properties.url || '#';
            const thumbnail = properties.thumbnail || 'default-thumbnail.jpg';

            let tags = properties.tags;
            if (typeof tags === 'string') {
                try {
                    tags = JSON.parse(tags);
                } catch (error) {
                    console.error("Error parsing tags JSON:", error);
                    tags = {};
                }
            }

            const popupTopics = Array.isArray(tags?.topic) ? tags.topic.join(', ') : 'No Topics';
            const popupArtforms = Array.isArray(tags?.artform) ? tags.artform.join(', ') : 'No Art Forms';

            new mapboxgl.Popup()
                .setLngLat(coordinates)
                .setHTML(`
                    <div class="card bg-neutral shadow-xl -m-5 text-white">
                     <a href="${thumbnail}" target="_blank">
                        <img src="${thumbnail}" alt="${title}" class="card-img-top" style="max-height: 200px; object-fit: cover;">
                        </a>
                            <h3 class="card-title">${title}</h3>
                            <p><strong>Artist:</strong> ${artist}</p>
                            <p><strong>Description:</strong> ${description}</p>
                            <p><strong>Year:</strong> ${year}</p>
                            <p><strong>Topics:</strong> ${popupTopics}</p>
                            <p><strong>Art Forms:</strong> ${popupArtforms}</p>
                            <a href="${url}" target="_blank" class="btn btn-primary">Learn More (external URL)</a>
                        </div>
                    </div>
                `)
                .addTo(map);
        });

    } catch (error) {
        console.error("Error loading data:", error);
    }
});


// Populate dropdown filters
function populateFilterDropdowns(artworkData, topicClusters) {
    let artforms = new Set();
    artworkData.features.forEach(feature => {
        if (feature.properties.tags) {
            feature.properties.tags.artform?.forEach(tag => artforms.add(tag));
        }
    });

    // 🔹 Sortiere Topics, Artforms und Clusters alphabetisch
    //const sortedTopics = [...topics].sort((a, b) => a.localeCompare(b));
    const sortedArtforms = [...artforms].sort((a, b) => a.localeCompare(b));
    let sortedTopicClusters = Object.fromEntries(Object.entries(topicClusters).sort(([a], [b]) => a.localeCompare(b)));

    //const topicSelect = document.getElementById('tag-filter');
     //topicSelect.innerHTML = '<option value="">All Topics</option>';
     //sortedTopics.forEach(topic => {
        // const option = document.createElement('option');
         //option.value = topic;
         //option.textContent = topic;
         //topicSelect.appendChild(option);
    //});

    const artformSelect = document.getElementById('artform-filter');
    artformSelect.innerHTML = '<option value="">All Art Forms</option>';
    sortedArtforms.forEach(artform => {
        const option = document.createElement('option');
        option.value = artform;
        option.textContent = artform;
        artformSelect.appendChild(option);
    });

    const clusterSelect = document.getElementById('cluster-filter');
    clusterSelect.innerHTML = '<option value="">All Clusters</option>';
    Object.entries(sortedTopicClusters).forEach(([clusterName, clusterData]) => {
        const option = document.createElement('option');
        option.value = clusterName;
        option.textContent = clusterName;
        option.style.color = clusterData.color;
        clusterSelect.appendChild(option);
    });
}

document.getElementById('search-bar').addEventListener('input', () => {
    console.log("Search bar input detected, applying filters...");
    applyFilters();
});

//function updateArtworkCount() {
    //if (!map.getSource('artworks')) {
      //  console.warn("Artwork source not found!");
        //return;
    //}
    // 📌 Gefilterte Features abrufen
    //let filteredFeatures = map.queryRenderedFeatures({ layers: ['unclustered-point'] });

    // 📌 Anzahl der gefilterten Kunstwerke berechnen
    //let filteredCount = filteredFeatures.length;

    // 📌 Aktualisieren der Anzeige
    //const countElement = document.getElementById('artwork-count');
    //if (countElement) {
    //    countElement.textContent = `Filtered Artworks: ${filteredCount}`;
    //} else {
    //   console.warn("Element mit ID 'artwork-count' nicht gefunden.");
    //}
//}


function applyFilters() {
    if (!artworkData) {
        console.error("Artwork data is not loaded yet.");
        return;
    }
    let filter = ['all']; //Initialisiere Filter-Array
    const searchText = document.getElementById('search-bar').value.toLowerCase();
 //  const selectedTopics = Array.from(document.getElementById('tag-filter').selectedOptions)
 //       .map(option => option.value)
 //       .filter(value => value);
    const selectedArtForms = Array.from(document.getElementById('artform-filter').selectedOptions)
        .map(option => option.value)
        .filter(value => value);
    const selectedCluster = document.getElementById('cluster-filter').value;
    
// Werte aus den Jahresfeldern holen
    let yearFrom = document.getElementById('year-from').value.trim();
    let yearTo = document.getElementById('year-to').value.trim();

// Standardwerte setzen, falls die Eingabe leer ist
    yearFrom = yearFrom ? parseInt(yearFrom, 10) || 1800 : 1800;
    yearTo = yearTo ? parseInt(yearTo, 10) || 2100 : 2100;

// Sicherstellen, dass die Werte korrekt sind
    console.log("Year filter applied:", yearFrom, yearTo);

    // Filter anwenden
    if (!isNaN(yearFrom) && !isNaN(yearTo)) {
        filter.push([
            'all',
            ['>=', ['to-number', ['get', 'year']], yearFrom],
            ['<=', ['to-number', ['get', 'year']], yearTo]
        ]);
    }


    if (searchText) {
        filter.push([
            'any',
            ['>=', ['index-of', searchText, ['downcase', ['get', 'title']]], 0],
            ['>=', ['index-of', searchText, ['downcase', ['get', 'description']]], 0],
            ['>=', ['index-of', searchText, ['downcase', ['get', 'artist']]], 0] // 🔹 NEU: Suche nach Künstlernamen
        ]);
    }

    //if (selectedTopics.length > 0) {
      //  filter.push([
        //    'any',
          //  ...selectedTopics.map(topic => ['in', topic, ['coalesce', ['get', 'topic', ['get', 'tags']], ['literal', []]]])
        //]);
    //}

    

    if (selectedArtForms.length > 0) {
        filter.push([
            'any',
            ...selectedArtForms.map(artform => ['in', artform, ['coalesce', ['get', 'artform', ['get', 'tags']], ['literal', []]]])
        ]);
    }

    if (selectedCluster) {
        const clusterTopics = topicClusters[selectedCluster]?.topics || [];
        if (clusterTopics.length > 0) {
            filter.push([
                'any',
                ...clusterTopics.map(topic => ['in', topic, ['coalesce', ['get', 'topic', ['get', 'tags']], ['literal', []]]])
            ]);
        }
    }

    if (map.getLayer('unclustered-point')) {
        try {
            map.getSource('artworks').setData(artworkData);
            if (filter.length > 1) {
                map.setFilter('unclustered-point', filter);
            } else {
                map.setFilter('unclustered-point', null);
            }
        } catch (error) {
            console.error("Error applying filter:", error);
        }
    }
    //updateArtworkCount();
}



function resetFilters() {
    document.getElementById('search-bar').value = '';
    document.getElementById('artform-filter').selectedIndex = 0;
    document.getElementById('cluster-filter').selectedIndex = 0
    document.getElementById('year-from').value = '';
    document.getElementById('year-to').value = '';
    console.log("Artwork Count before reset:", artworkData.features.length);
    applyFilters();
    //updateArtworkCount();
}

document.getElementById('reset-filters').addEventListener('click', resetFilters);

['artform-filter', 'cluster-filter', 'year-from', 'year-to'].forEach(filterId => {
    document.getElementById(filterId).addEventListener('input', applyFilters);
});


