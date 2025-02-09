// Import Continent Mapping
import continentMapping from './continentMapping.js';

// Global variables
let countries = [];
let continents = [];
let topics = [];
let topicClusters = {};
let countryChart;
let topicClustersOverTimeChart;
let topicsByContinentChart;
let coOccurrenceNetwork;

/**
 * Load and analyze the data
 */
async function loadData() {
    try {
        console.log("Fetching artwork data...");
        const artworkResponse = await fetch('data/artwork-data.json');
        const data = await artworkResponse.json();
        console.log("Artwork Data Loaded:", data);

        // Extract unique countries, continents, and topics
        const extractedCountries = new Set();
        const extractedContinents = new Set();
        const extractedTopics = new Set();
        const continentCounts = {};

        data.features.forEach(feature => {
            const location = feature.properties.location || "";
            const locationParts = location.split(', ');
            let country = locationParts.length > 1 ? locationParts[1].trim() : locationParts[0].trim();

            const continent = continentMapping[country] || "Unknown";
            extractedCountries.add(country);
            extractedContinents.add(continent);

            // Extract topics
            (feature.properties.tags?.topic || []).forEach(topic => extractedTopics.add(topic));

            // Count topics per continent
            if (!continentCounts[continent]) {
                continentCounts[continent] = 0;
            }
            continentCounts[continent]++;
        });

        countries = Array.from(extractedCountries);
        continents = Array.from(extractedContinents);
        topics = Array.from(extractedTopics);

        populateTopicDropdown();
        initializeCountryChart(data);
        initializeTopicClustersOverTimeChart(data);
        initializeTopicsByContinentChart(continentCounts);
        initializeCoOccurrenceNetwork(data);
    } catch (error) {
        console.error("Error loading data:", error);
    }
}

/**
 * Populate Topic Dropdown
 */
function populateTopicDropdown() {
    const topicSelect = document.getElementById("topicSelect");
    topicSelect.innerHTML = '';

    topics.forEach(topic => {
        const option = document.createElement("option");
        option.value = topic;
        option.textContent = topic;
        topicSelect.appendChild(option);
    });
    console.log("Topics dropdown populated.");
}

/**
 * Initialize Co-Occurrence Network
 */
function initializeCoOccurrenceNetwork(data) {
    try {
        const coOccurrence = {};
        data.features.forEach(feature => {
            const topics = feature.properties.tags?.topic || [];
            topics.forEach((topic, i) => {
                for (let j = i + 1; j < topics.length; j++) {
                    const pair = [topic, topics[j]].sort().join('---');
                    coOccurrence[pair] = (coOccurrence[pair] || 0) + 1;
                }
            });
        });

        const nodes = new Set();
        const edges = [];
        Object.entries(coOccurrence).forEach(([pair, weight]) => {
            const [topic1, topic2] = pair.split('---');
            nodes.add(topic1);
            nodes.add(topic2);
            edges.push({ from: topic1, to: topic2, value: weight });
        });

        const networkData = {
            nodes: Array.from(nodes).map(topic => ({ id: topic, label: topic, font: { color: '#FFFFFF', size: 14 } })),
            edges: edges.map(edge => ({ ...edge, color: '#AAAAAA', width: edge.value * 0.5 }))
        };

        const container = document.getElementById('coOccurrenceNetwork');
        coOccurrenceNetwork = new vis.Network(container, networkData, {
            nodes: { shape: 'dot', size: 10 },
            edges: { smooth: true },
            physics: { stabilization: true }
        });

        console.log("Co-Occurrence Network initialized.");
    } catch (error) {
        console.error("Error initializing coOccurrenceNetwork:", error);
    }
}

// Start data loading
loadData();
