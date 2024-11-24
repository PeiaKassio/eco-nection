const fs = require('fs');

try {
    // Load JSON files
    const topicClusters = JSON.parse(fs.readFileSync('topicClusters.json', 'utf-8'));
    const artworkData = JSON.parse(fs.readFileSync('artwork-data.json', 'utf-8'));

    console.log("Artwork Data Loaded:", artworkData);

    // Extract the features array from the FeatureCollection
    const artworkFeatures = artworkData.features;

    if (!Array.isArray(artworkFeatures)) {
        throw new Error("artworkData.features is not an array!");
    }

    // Extract all topics from topicClusters
    const allTopics = Object.values(topicClusters)
        .flatMap(cluster => cluster.topics); // Combine topics arrays from all clusters

    console.log("All Topics in Clusters:", allTopics);

    // Check if artwork topics exist in topicClusters
    const missingTopics = [];
    artworkFeatures.forEach(artwork => {
        const artworkTopics = artwork.properties.tags.topic; // Extract topics from artwork
        artworkTopics.forEach(topic => {
            if (!allTopics.includes(topic)) {
                missingTopics.push({ artwork: artwork.properties.title, topic });
            }
        });
    });

    // Output missing topics
    if (missingTopics.length > 0) {
        console.log("Missing Topics Found:");
        missingTopics.forEach(missing => {
            console.log(`- Artwork: "${missing.artwork}", Missing Topic: "${missing.topic}"`);
        });
    } else {
        console.log("All topics are valid!");
    }

    // Check for duplicates
    const duplicates = [];
    const seenArtworks = new Set();

    artworkFeatures.forEach(artwork => {
        const uniqueKey = `${artwork.properties.title}-${artwork.properties.location}-${artwork.properties.year}`;
        if (seenArtworks.has(uniqueKey)) {
            duplicates.push(artwork.properties.title);
        } else {
            seenArtworks.add(uniqueKey);
        }
    });

    // Output duplicates
    if (duplicates.length > 0) {
        console.log("Duplicate Artworks Found:");
        duplicates.forEach(duplicate => console.log(`- ${duplicate}`));
    } else {
        console.log("No duplicate artworks found!");
    }
} catch (error) {
    console.error("Error:", error.message);
}
