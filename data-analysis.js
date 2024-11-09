// Global variables
let topicClusters = {};
let countryChart; // Variable to hold the chart instance

// Define continents and their respective countries
const continentCountries = {
   "Africa": ["Nigeria", "Kenya", "South Africa", "Egypt", "Ghana", "Morocco", "Ethiopia"],
   "Asia": ["China", "India", "Japan", "South Korea", "Indonesia", "Turkey", "Saudi Arabi", "United Arab Emirates","Thailand", "Malaysia","Singapore"],
   "Europe": ["United Kingdom", "Germany", "France", "Netherlands", "Italy", "Spain", "Russia", "Sweden", "Switzerland", "Poland", "Norway"],
   "North America": ["United States", "Canada", "Mexico"],
   "Oceania": ["Australia", "New Zealand"],
   "South America": ["Brazil", "Argentina", "Chile", "Colombia","Peru"]
};

// Load and analyze the data
async function loadData() {
   const response = await fetch('artwork-data.json');
   const data = await response.json();
   
   // Populate continent selection
   const continentSelect = document.getElementById('continentSelect');
   Object.keys(continentCountries).forEach(continent => {
       const option = document.createElement('option');
       option.value = continent;
       option.textContent = continent;
       continentSelect.appendChild(option);
   });

   // Load topic clusters
   const clusterResponse = await fetch('topicClusters.json');
   topicClusters = await clusterResponse.json();

   // Load initial countries for the first continent (if needed)
   loadCountriesByContinent();
}

// Show selected tab
function showTab(tabId) {
   document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
   document.getElementById(tabId).classList.add('active');
}

// Load data for Topic Cluster by Country
async function loadCountryData() {
   const selectedCountries = Array.from(document.getElementById('countrySelect').selectedOptions).map(option => option.value);
   
   const tagsByCountry = {};
   
   const response = await fetch('artwork-data.json');
   const data = await response.json();

   data.features.forEach((feature) => {
       const locationParts = feature.properties.location.split(', ');
       const country = locationParts.length > 1 ? locationParts[1] : locationParts[0]; // Extract country after first comma
       if (selectedCountries.includes(country)) {
           const topics = feature.properties.tags.topic || [];
           topics.forEach(topic => {
               // Find the cluster for each topic
               for (const [clusterName, clusterInfo] of Object.entries(topicClusters)) {
                   if (clusterInfo.topics.includes(topic)) {
                       if (!tagsByCountry[country]) tagsByCountry[country] = {};
                       tagsByCountry[country][clusterName] = (tagsByCountry[country][clusterName] || 0) + 1; // Count occurrences of each cluster
                   }
               }
           });
       }
   });

   createCountryClusterChart(tagsByCountry);
}

// Create bar chart for topic clusters by country
function createCountryClusterChart(data) {
   const ctx = document.getElementById('countryChart').getContext('2d');

   // If the chart already exists, destroy it before creating a new one
   if (countryChart) {
       countryChart.destroy();
   }

   const datasets = [];
   const countriesArray = Object.keys(data);

   countriesArray.forEach(country => {
       Object.keys(data[country]).forEach(cluster => {
           if (!datasets.find(dataset => dataset.label === cluster)) { // Create a new dataset for each unique cluster
               datasets.push({
                   label: cluster,
                   data: countriesArray.map(c => (c === country ? data[country][cluster] : 0)),
                   backgroundColor: topicClusters[cluster].color, // Use color from clusters JSON
               });
           }
       });
   });

   // Create new chart instance
   countryChart = new Chart(ctx, {
       type: 'bar',
       data: {
           labels: countriesArray,
           datasets: datasets,
       },
       options: {
           plugins: {
               title: {
                   display: true,
                   text: 'Topic Clusters by Country'
               },
           },
           responsive: true,
           scales: {
               x: { stacked: true },
               y: { beginAtZero: true },
           },
       }
   });
}

// Load data for Topic Cluster by Year
async function loadYearData() {
   const response = await fetch('artwork-data.json');
   const data = await response.json();

   const yearCounts = {};
   
   data.features.forEach((feature) => {
       const year = feature.properties.year; // Assuming year is available in properties
       if (year) {
           if (!yearCounts[year]) yearCounts[year] = {};
           const topics = feature.properties.tags.topic || [];
           
           topics.forEach(topic => {
               // Find the cluster for each topic
               for (const [clusterName, clusterInfo] of Object.entries(topicClusters)) {
                   if (clusterInfo.topics.includes(topic)) {
                       yearCounts[year][clusterName] = (yearCounts[year][clusterName] || 0) + 1; // Count occurrences of each cluster per year
                   }
               }
           });
       }
   });

   createYearClusterChart(yearCounts);
}

// Create line chart for topic clusters by year
function createYearClusterChart(data) {
   const ctx = document.getElementById('yearChart').getContext('2d');

   const years = Object.keys(data).map(year => parseInt(year));
   
   // Prepare datasets
   const clustersSet = new Set();
   
   years.forEach(year => {
       Object.keys(data[year]).forEach(cluster => clustersSet.add(cluster));
   });

   const datasets = Array.from(clustersSet).map(cluster => ({
       label: cluster,
       data: years.map(year => data[year][cluster] || 0),
       borderColor: topicClusters[cluster].color, // Use color from clusters JSON
       fill: false,
       tension: 0.1,
     }));

     new Chart(ctx, {
         type: 'line',
         data: {
             labels: years,
             datasets: datasets,
         },
         options: {
             plugins: {
                 title: {
                     display: true,
                     text: 'Topic Clusters by Year'
                 },
             },
             responsive: true,
             scales: {
                 x: { 
                     type: 'linear',
                     position: 'bottom',
                 },
                 y: { beginAtZero: true },
             },
         }
     });
}

// Load data for Topic Cluster by Art Form
async function loadArtFormData() {
   const response = await fetch('artwork-data.json');
   const data = await response.json();

   const tagsByArtForm = {};
   
   data.features.forEach((feature) => {
       const artforms = feature.properties.tags.artform || [];
       const topics = feature.properties.tags.topic || [];

       artforms.forEach(artform => {
           if (!tagsByArtForm[artform]) tagsByArtForm[artform] = {};
           topics.forEach(topic => {
               // Find the cluster for each topic
               for (const [clusterName, clusterInfo] of Object.entries(topicClusters)) {
                   if (clusterInfo.topics.includes(topic)) {
                       tagsByArtForm[artform][clusterName] = (tagsByArtForm[artform][clusterName] || 0) + 1; // Count occurrences of each cluster per art form
                   }
               }
           });
       });
   });

   createArtFormClusterChart(tagsByArtForm);
}

// Create bar chart for topic clusters by art form
function createArtFormClusterChart(data) {
   const ctx = document.getElementById('artformChart').getContext('2d');

   const artforms = Object.keys(data);
   
   // Prepare datasets
   const datasets = [];
   
   artforms.forEach(artform => {
       Object.keys(data[artform]).forEach(cluster => {
           if (!datasets.find(dataset => dataset.label === cluster)) { // Create a new dataset for each unique cluster
               datasets.push({
                   label: cluster,
                   data: artforms.map(a => (a === artform ? data[artform][cluster] : 0)),
                   backgroundColor: topicClusters[cluster].color, // Use color from clusters JSON
               });
           }
       });
   });

   new Chart(ctx, {
       type: 'bar',
       data: {
           labels: artforms,
           datasets: datasets,
       },
       options: {
           plugins: {
               title: {
                   display: true,
                   text: 'Topic Clusters by Art Form'
               },
           },
           responsive: true,
           scales: {
               x: { stacked: true },
               y: { beginAtZero: true },
           },
       }
   });
}

// Initial load of data when the page loads
loadData().then(() => loadYearData()).then(() => loadArtFormData());
