ECHO ist eingeschaltet (ON).
mapboxgl.accessToken = 'pk.eyJ1IjoicGVpc2thc3NpbyIsImEiOiJjbTM4dnF4amEwbXB2MmtyMTNvM2h6M3M4In0.lMQxgMaKvSoleeld1DLOsA'; // Replace with your Mapbox token

const map = new mapboxgl.Map({
    container: 'map', // ID of the HTML element
    style: 'mapbox://styles/peiskassio/cm38wege300j601pd4oe2f3re', // Replace with your Mapbox style URL
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
