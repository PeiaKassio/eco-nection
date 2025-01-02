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

    // Check all entries have valid properties and tags
    artworkFeatures.forEach((artwork, index) => {
        const properties = artwork.properties;
        const title = properties?.title || "Untitled";
    
        if (!properties || typeof properties !== 'object') {
            console.error(`Invalid properties in artwork titled "${title}". Full data:`, artwork);
            throw new Error(`Invalid properties in artwork titled "${title}". Each artwork must have a 'properties' object.`);
        }
    
        if (!properties.tags || typeof properties.tags !== 'object') {
            console.error(`Missing or invalid 'tags' in artwork titled "${title}". Full data:`, artwork);
            throw new Error(`Missing or invalid 'tags' in artwork titled "${title}".`);
        }
    
        if (!Array.isArray(properties.tags.topic)) {
            console.error(`Missing or invalid 'topic' array in 'tags' for artwork titled "${title}". Full data:`, artwork);
            throw new Error(`Missing or invalid 'topic' array in 'tags' for artwork titled "${title}".`);
        }
    });

    // Check if artwork topics exist in topicClusters
    const missingTopics = [];
    artworkFeatures.forEach(artwork => {
        const title = artwork.properties.title || "Untitled";
        const artworkTopics = artwork.properties.tags.topic;

        artworkTopics.forEach(topic => {
            if (!allTopics.includes(topic)) {
                missingTopics.push({ artwork: title, topic });
            }
        });
    });

    // Output missing topics
    if (missingTopics.length > 0) {
        console.log("Missing Topics Found:");
        missingTopics.forEach(missing => {
            console.log(`- Artwork: "${missing.artwork}", Missing Topic: "${missing.topic}"`);
        });
        throw new Error("Some topics in the artworks do not exist in topicClusters. Please fix the data.");
    } else {
        console.log("All topics are valid!");
    }

    // Check for duplicates
    const duplicates = [];
    const seenArtworks = new Set();

    artworkFeatures.forEach(artwork => {
        const properties = artwork.properties;
        const title = properties.title || "Untitled";
        const uniqueKey = `${title}-${properties.location}-${properties.year}`;
        if (seenArtworks.has(uniqueKey)) {
            duplicates.push(title);
        } else {
            seenArtworks.add(uniqueKey);
        }
    });

    // Output duplicates
    if (duplicates.length > 0) {
        console.log("Duplicate Artworks Found:");
        duplicates.forEach(duplicate => console.log(`- ${duplicate}`));
        throw new Error("Duplicate entries found in the artwork data. Please fix the data.");
    } else {
        console.log("No duplicate artworks found!");
    }

    console.log("Validation completed successfully!");
} catch (error) {
    console.error("Validation Error:", error.message);
    process.exit(1); // Exit the process with a non-zero status code
}
