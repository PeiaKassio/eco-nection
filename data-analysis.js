import continentMapping from './continentMapping.js';

async function loadData() {
    try {
        const response = await fetch('artwork-data.json');
        const data = await response.json();
        console.log('Loaded data:', data); // Confirm data load

        const tagsByCountry = {};
        const tagsByContinent = {};
        const focusShiftByContinent = {};

        data.features.forEach((feature) => {
            const location = feature.properties.location;
            const country = location.split(', ').pop();
            const continent = continentMapping[country] || "Other";
            const topics = feature.properties.tags.topic || [];
            const year = feature.properties.year || "Unknown";

            console.log(`Processing ${country} in ${continent} for year ${year}`);

            // Count topics by country
            if (!tagsByCountry[country]) tagsByCountry[country] = {};
            topics.forEach(topic => {
                tagsByCountry[country][topic] = (tagsByCountry[country][topic] || 0) + 1;
            });

            // Count topics by continent
            if (!tagsByContinent[continent]) tagsByContinent[continent] = {};
            topics.forEach(topic => {
                tagsByContinent[continent][topic] = (tagsByContinent[continent][topic] || 0) + 1;
            });

            // Track environmental focus shift by continent over time
            if (!focusShiftByContinent[continent]) focusShiftByContinent[continent] = {};
            if (!focusShiftByContinent[continent][year]) focusShiftByContinent[continent][year] = {};
            topics.forEach(topic => {
                focusShiftByContinent[continent][year][topic] = 
                    (focusShiftByContinent[continent][year][topic] || 0) + 1;
            });
        });

        console.log('Tags by Country:', tagsByCountry);
        console.log('Tags by Continent:', tagsByContinent);
        console.log('Focus Shift Over Time:', focusShiftByContinent);

        // Generate the charts
        createTagsByCountryChart(tagsByCountry);
        createTagsByContinentChart(tagsByContinent);
        createFocusShiftOverTimeChart(focusShiftByContinent);
    } catch (error) {
        console.error('Error loading or processing data:', error);
    }
}

