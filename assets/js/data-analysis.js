// Globale Variablen für Daten
let artworks = [];
let topicClusters = {};
let continentMapping = {};

// Filterwerte
let selectedContinent = [];
let selectedCountry = [];
let selectedTopics = [];
let countryOptionsMaster = []; // unveränderte Voll-Liste für die Suche

// ---------- Helfer: Länder normalisieren & Kontinent ermitteln ----------
function normalizeCountry(name) {
    if (!name) return "";
    let c = String(name).trim();
    const lower = c.toLowerCase();

    // Synonyme/Varianzen nach Bedarf erweitern
    const synonyms = {
        "usa": "United States",
        "u.s.a.": "United States",
        "united states of america": "United States",
        "uk": "United Kingdom",
        "u.k.": "United Kingdom",
        "england": "United Kingdom",
        "scotland": "United Kingdom",
        "wales": "United Kingdom",
        "south korea": "Korea, Republic of",
        "north korea": "Korea, Democratic People's Republic of",
        "russia": "Russian Federation"
    };
    if (synonyms[lower]) return synonyms[lower];

    // Erste Buchstaben groß (simple Variante)
    return c.replace(/\w\S*/g, s => s.charAt(0).toUpperCase() + s.slice(1));
}

function getContinentForCountry(country) {
    const norm = normalizeCountry(country);

    // exakte Übereinstimmung
    if (continentMapping[norm]) return continentMapping[norm];

    // case-insensitive Fallback
    const key = Object.keys(continentMapping).find(k => k.toLowerCase() === norm.toLowerCase());
    return key ? continentMapping[key] : "Other";
}

// Daten laden
async function loadData() {
    try {
        // JSON-Dateien aus dem 'data'-Ordner laden
        artworks = await fetch('data/artwork-data.json').then(res => {
            if (!res.ok) throw new Error('Failed to load artwork-data.json');
            return res.json();
        });

        topicClusters = await fetch('data/topicClusters.json').then(res => {
            if (!res.ok) throw new Error('Failed to load topicClusters.json');
            return res.json();
        });

        continentMapping = await fetch('data/continentMapping.json').then(res => {
            if (!res.ok) throw new Error('Failed to load continentMapping.json');
            return res.json();
        });

        console.log("JSON files loaded successfully");
        initializeFilters();
        applyFilters();
        updateCharts();
    } catch (error) {
        console.error("Error loading JSON data:", error);
    }
}

// Filter-Initialisierung
function initializeFilters() {
    const continentSelect = document.getElementById('continentSelect');
    const countrySelect = document.getElementById('countrySelect');
    const topicClusterSelect = document.getElementById('topicClusterSelect');
    const countrySearch = document.getElementById('countrySearch');

    // "Alle"-Option zu den Filtern hinzufügen
    continentSelect.add(new Option('All Continents', 'all'));
    countrySelect.add(new Option('All Countries', 'all'));
    topicClusterSelect.add(new Option('All Topic Clusters', 'all'));

    // Kontinente füllen (alphabetisch sortiert)
    let uniqueContinents = new Set(Object.values(continentMapping));
    let sortedContinents = Array.from(uniqueContinents).sort();
    sortedContinents.forEach(continent => {
        continentSelect.add(new Option(continent, continent));
    });

    // Länder AUS DEN ARTWORKS ableiten (robust gegen abweichende Schreibweisen)
    const countrySet = new Set(
        (artworks.features || []).map(f => {
            const loc = String(f?.properties?.location || "");
            const rawCountry = loc.split(", ").pop();
            return normalizeCountry(rawCountry);
        }).filter(Boolean)
    );
    const sortedCountriesFromArtworks = Array.from(countrySet).sort();
    sortedCountriesFromArtworks.forEach(country => {
        countrySelect.add(new Option(country, country));
    });

    // Masterliste nach dem Befüllen sichern (ohne die "All"-Option)
    countryOptionsMaster = Array.from(countrySelect.options)
      .filter(o => o.value !== 'all')
      .map(o => ({ value: o.value, text: o.text }));

    // Themencluster füllen (alphabetisch sortiert)
    let sortedTopicClusters = Object.keys(topicClusters).sort();
    sortedTopicClusters.forEach(cluster => {
        topicClusterSelect.add(new Option(cluster, cluster));
    });

    // Funktion zum Entfernen von "All", wenn eine andere Option gewählt wird
    function deselectAllOption(selectElement) {
        const allOption = selectElement.querySelector('option[value="all"]');
        if (allOption &
