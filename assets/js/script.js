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
let artworkFeatures; // Declare the variable

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

        // Assign features to artworkFeatures
        artworkFeatures = artworkData.features; // Ensure this line is included

        const topicClusterResponse = await fetch('data/topicClusters.json');
        topicClusters = await topicClusterResponse.json();

        // Function to get cluster color based on topic
        function getClusterColor(firstTopic) {
            for (const [cluster, data] of Object.entries(topicClusters)) {
                if (data.topics.includes(firstTopic)) {
                    return data.color;
                }
            }
            return '#ffffff';
        }

        // Check if artworkFeatures is defined and process it
        if (Array.isArray(artworkFeatures)) {
            artworkFeatures.forEach((feature, index) => {
                if (feature && feature.properties) {
                    const artworkTopics = feature.properties.tags?.topic;

                    if (Array.isArray(artworkTopics)) {
                        artworkTopics.forEach(topic => {
                            if (!allTopics.includes(topic)) {
                                missingTopics.push({ artwork: feature.properties.title, topic });
                            }
                        });
                    } else {
                        console.warn(`Feature at index ${index} ("${feature.properties.title}") does not have valid topics.`);
                    }
                } else {
                    console.warn(`Feature at index ${index} is missing properties.`);
                }
            });
        } else {
            console.warn("No valid artwork features available.");
        }
    } catch (error) {
        console.error("Error loading data:", error);
    }
});

        populateFilterDropdowns(artworkData, topicClusters);

        map.addSource('artworks', {
            type: 'geojson',
            data: artworkData
        });

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

        map.on('click', 'unclustered-point', (e) => {
            const coordinates = e.features[0].geometry.coordinates.slice();
            const properties = e.features[0].properties || {};
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

             // If tags is not an object or array, initialize it as an empty object
             if (typeof tags !== 'object' || !tags) {
             tags = {};
            }
            // Prepare topics and artforms for display
            const popupTopics = Array.isArray(tags.topic) ? tags.topic.join(', ') : 'No Topics';
            const popupArtforms = Array.isArray(tags.artform) ? tags.artform.join(', ') : 'No Art Forms';

            new mapboxgl.Popup()
                .setLngLat(coordinates)
                .setHTML(`
                    <div class="card bg-neutral shadow-xl -m-5 text-white">
                    <img src="${thumbnail}" alt="${title}" class="card-img-top" style="max-height: 200px; object-fit: cover;">
                        <div class="card-body">
                            <h3 class="card-title">${title}</h3>
                            <p><strong>Artist:</strong> ${artist}</p>
                            <p><strong>Description:</strong> ${description}</p>
                            <p><strong>Year:</strong> ${year}</p>
                            <p><strong>Topics:</strong> ${popupTopics}</p>
                            <p><strong>Art Forms:</strong> ${popupArtforms}</p>
                            href="${url}" target="_blank" class="btn btn-primary">Learn More</a>
                            <p class="mt-2"><small>Thumbnail Source: ${thumbnail}</small></p>
                        </div>
                    </div>
                `)
                .addTo(map);
        });
    } catch (error) {
        console.error("Error loading data:", error);
    }
});

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

document.getElementById('search-bar').addEventListener('input', () => {
    console.log("Search bar input detected, applying filters...");
    applyFilters();
});

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
    const selectedCluster = document.getElementById('cluster-filter').value;

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
            ...selectedTopics.map(topic => ['in', topic, ['coalesce', ['get', 'topic', ['get', 'tags']], ['literal', []]]])
        ]);
    }

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
}

function resetFilters() {
    document.getElementById('search-bar').value = '';
    document.getElementById('tag-filter').selectedIndex = 0;
    document.getElementById('artform-filter').selectedIndex = 0;
    document.getElementById('cluster-filter').selectedIndex = 0;
    applyFilters();
}

document.getElementById('reset-filters').addEventListener('click', resetFilters);

['tag-filter', 'artform-filter', 'cluster-filter'].forEach(filterId => {
    document.getElementById(filterId).addEventListener('change', applyFilters);
});
