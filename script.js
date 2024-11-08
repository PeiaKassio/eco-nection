ECHO ist eingeschaltet (ON).
mapboxgl.accessToken = 'YOUR_MAPBOX_ACCESS_TOKEN'; // Replace with your Mapbox token

const map = new mapboxgl.Map({
    container: 'map', // ID of the HTML element
    style: 'YOUR_MAPBOX_STYLE_URL', // Replace with your Mapbox style URL
    center: [10.0, 50.0], // Center coordinates [lng, lat]
    zoom: 5 // Zoom level
});

// Example data points for art locations
const locations = [
    { lng: 10.0, lat: 50.0, description: "Art Location 1" },
    { lng: 10.5, lat: 50.5, description: "Art Location 2" }
];

// Add markers for each location
locations.forEach((loc) => {
    const marker = new mapboxgl.Marker()
        .setLngLat([loc.lng, loc.lat])
        .setPopup(new mapboxgl.Popup().setText(loc.description))
        .addTo(map);
});
