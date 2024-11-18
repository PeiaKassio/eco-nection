function applyFilters() {
    const searchText = document.getElementById('search-bar').value.toLowerCase();
    const selectedTopics = Array.from(document.getElementById('tag-filter').selectedOptions).map(option => option.value).filter(value => value);
    const selectedArtForms = Array.from(document.getElementById('artform-filter').selectedOptions).map(option => option.value).filter(value => value);
    const selectedClusters = Array.from(document.getElementById('cluster-filter').selectedOptions).map(option => option.value).filter(value => value);

    const filter = ['all'];

    const noFilterSelected = !searchText && selectedTopics.length === 0 && selectedArtForms.length === 0 && selectedClusters.length === 0;

    if (noFilterSelected) {
        map.setFilter('unclustered-point', null);
        map.setFilter('clusters', null); // Reset clusters to show all
        console.log("Resetting filter to show all points and clusters."); 
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

    console.log("Applying filter:", filter); 

    // Apply filter to unclustered-point layer
    if (map.getLayer('unclustered-point')) {
        map.setFilter('unclustered-point', filter.length > 1 ? filter : null);
    }

    // Apply filter to clusters
    if (map.getLayer('clusters')) {
        const filteredPoints = map.querySourceFeatures('artworks', {
            filter: filter.length > 1 ? filter : null,
        });

        // Get all clusters that have matching points
        const clusterIdsToShow = new Set(filteredPoints.map(f => f.properties.cluster_id));

        // Dynamically hide clusters without matches
        map.setFilter('clusters', [
            'any',
            ...Array.from(clusterIdsToShow).map(id => ['==', ['get', 'cluster_id'], id]),
        ]);
    }
}
