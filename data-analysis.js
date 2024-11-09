// Global variables
let countries = [];

// Load and analyze the data
async function loadData() {
    const response = await fetch('artwork-data.json');
    const data = await response.json();
    
    // Populate country selection
    countries = [...new Set(data.features.map(feature => feature.properties.location.split(', ').pop()))];
    
    const countrySelect = document.getElementById('countrySelect');
    countries.forEach(country => {
        const option = document.createElement('option');
        option.value = country;
        option.textContent = country;
        countrySelect.appendChild(option);
    });
}

// Show selected tab
function showTab(tabId) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
}

// Load data for Topic Cluster by Country
async function loadCountryData() {
    const response = await fetch('artwork-data.json');
    const data = await response.json();
    const clustersResponse = await fetch('topicClusters.json');
    const clustersData = await clustersResponse.json();

    const selectedCountries = Array.from(document.getElementById('countrySelect').selectedOptions).map(option => option.value);
    
    const tagsByCountry = {};
    
    // Map topics to clusters
    const topicToClusterMap = {};
    clustersData.clusters.forEach(cluster => {
        cluster.topics.forEach(topic => {
            topicToClusterMap[topic] = cluster.name;
        });
    });

    data.features.forEach((feature) => {
        const country = feature.properties.location.split(', ').pop();
        if (selectedCountries.includes(country)) {
            const topics = feature.properties.tags.topic || [];
            const clusterName = topicToClusterMap[topics[0]];

            if (!tagsByCountry[country]) tagsByCountry[country] = {};
            if (clusterName) {
                tagsByCountry[country][clusterName] = (tagsByCountry[country][clusterName] || 0) + 1;
            }
        }
    });

    createCountryClusterChart(tagsByCountry);
}

// Create bar chart for topic clusters by country
function createCountryClusterChart(data) {
    const ctx = document.getElementById('countryChart').getContext('2d');
    
    const countries = Object.keys(data);
    const clusters = [...new Set(countries.flatMap(country => Object.keys(data[country])))];

    const datasets = clusters.map(cluster => ({
        label: cluster,
        data: countries.map(country => data[country][cluster] || 0),
        backgroundColor: getRandomColor(),
    }));

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: countries,
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
                y: { beginAtZero: true, stacked: true },
            },
        }
    });
}

// Load data for Topic by Year
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
                yearCounts[year][topic] = (yearCounts[year][topic] || 0) + 1;
            });
        }
    });

    createYearTopicChart(yearCounts);
}

// Create line chart for topics by year
function createYearTopicChart(data) {
    const ctx = document.getElementById('yearChart').getContext('2d');

    const years = Object.keys(data).map(year => parseInt(year));
    
    // Get min and max year
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);

   // Prepare datasets
   const topicsSet = new Set();
    
   years.forEach(year => {
       Object.keys(data[year]).forEach(topic => topicsSet.add(topic));
   });

   const datasets = Array.from(topicsSet).map(topic => ({
       label: topic,
       data: years.map(year => data[year][topic] || 0),
       borderColor: getRandomColor(),
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
                     text: 'Topics by Year'
                 },
             },
             responsive: true,
             scales: {
                 x: { 
                     type: 'linear',
                     position: 'bottom',
                     min: minYear,
                     max: maxYear
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
   const clustersResponse = await fetch('topicClusters.json');
   const clustersData = await clustersResponse.json();

   const tagsByArtForm = {};
   
   // Map topics to clusters
   const topicToClusterMap = {};
   clustersData.clusters.forEach(cluster => {
       cluster.topics.forEach(topic => {
           topicToClusterMap[topic] = cluster.name;
       });
   });

   data.features.forEach((feature) => {
       const artforms = feature.properties.tags.artform || [];
       const topics = feature.properties.tags.topic || [];
       const clusterName = topicToClusterMap[topics[0]];

       artforms.forEach(artform => {
           if (!tagsByArtForm[artform]) tagsByArtForm[artform] = {};
           if (clusterName) {
               tagsByArtForm[artform][clusterName] = (tagsByArtForm[artform][clusterName] || 0) + 1;
           }
       });
   });

   createArtFormClusterChart(tagsByArtForm);
}

// Create bar chart for topic clusters by art form
function createArtFormClusterChart(data) {
   const ctx = document.getElementById('artformChart').getContext('2d');

   const artforms = Object.keys(data);
   const clustersSet = [...new Set(artforms.flatMap(artform => Object.keys(data[artform])))];

   const datasets = clustersSet.map(cluster => ({
       label: cluster,
       data: artforms.map(artform => data[artform][cluster] || 0),
       backgroundColor: getRandomColor(),
   }));

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
               y: { beginAtZero: true, stacked: true },
           },
       }
   });
}

// Utility function to generate random colors for the chart
function getRandomColor() {
   const letters = '0123456789ABCDEF';
   let color = '#';
   for (let i = 0; i < 6; i++) {
       color += letters[Math.floor(Math.random() * 16)];
   }
   return color;
}

// Initial load of data
loadData().then(() => loadYearData()).then(() => loadArtFormData());
