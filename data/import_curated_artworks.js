const fs = require('node:fs');
const path = require('node:path');

const artworkPath = path.join(__dirname, 'artwork-data.json');
const data = JSON.parse(fs.readFileSync(artworkPath, 'utf8'));

const curatedArtworks = [
  {
    title: 'Wheatfield - A Confrontation',
    artist: 'Agnes Denes',
    type: 'Land Art / Public Intervention',
    location: 'New York, USA',
    year: 1982,
    coordinates: [-74.0134, 40.7056],
    description: 'A two-acre wheat field planted on landfill in lower Manhattan, confronting urban development, food systems, land value, and ecological imagination.',
    topics: ['Food Systems', 'Urban Ecology', 'Environmental Awareness', 'Landfill Issues'],
    artform: ['Land Art', 'Public Art', 'Installation'],
    url: 'https://www.agnesdenesstudio.com/works7.html',
    thumbnail: ''
  },
  {
    title: '7000 Oaks',
    artist: 'Joseph Beuys',
    type: 'Social Sculpture',
    location: 'Kassel, Germany',
    year: 1982,
    coordinates: [9.4797, 51.3127],
    description: 'A long-term urban tree-planting action pairing basalt stones with oaks, framing ecological restoration as civic sculpture and social transformation.',
    topics: ['Urban Ecology', 'Green Spaces', 'Climate Action', 'Human-Nature Interaction'],
    artform: ['Public Art', 'Social Sculpture', 'Ecological Art'],
    url: 'https://www.diaart.org/visit/visit-our-locations-sites/joseph-beuys-7000-oaks',
    thumbnail: ''
  },
  {
    title: 'Time Landscape',
    artist: 'Alan Sonfist',
    type: 'Land Art',
    location: 'New York, USA',
    year: 1978,
    coordinates: [-73.9994, 40.7256],
    description: 'A living urban forest artwork restoring native precolonial vegetation in Manhattan and making urban ecology visible in public space.',
    topics: ['Urban Ecology', 'Biodiversity', 'Natural Habitat', 'Conservation'],
    artform: ['Land Art', 'Public Art', 'Living Sculpture'],
    url: 'https://www.nycgovparks.org/parks/time-landscape',
    thumbnail: ''
  },
  {
    title: 'Touch Sanitation',
    artist: 'Mierle Laderman Ukeles',
    type: 'Performance',
    location: 'New York, USA',
    year: 1979,
    coordinates: [-73.9857, 40.7484],
    description: 'A citywide performance engaging sanitation workers and waste infrastructures, linking maintenance labor, urban waste, and environmental systems.',
    topics: ['Waste Management', 'Urban Pollution', 'Environmental Justice', 'Human-Nature Interaction'],
    artform: ['Performance', 'Social Practice', 'Public Art'],
    url: 'https://www.queensmuseum.org/exhibition/mierle-laderman-ukeles-maintenance-art/',
    thumbnail: ''
  },
  {
    title: 'The Farm',
    artist: 'Bonnie Ora Sherk',
    type: 'Urban Ecology Project',
    location: 'San Francisco, USA',
    year: 1974,
    coordinates: [-122.4194, 37.7749],
    description: 'An early urban ecology and community art project that transformed traffic-adjacent land into gardens, animal habitats, and environmental learning spaces.',
    topics: ['Urban Farming', 'Urban Ecology', 'Environmental Education', 'Green Spaces'],
    artform: ['Public Art', 'Community Art', 'Ecological Art'],
    url: 'https://www.alivinglibrary.org/',
    thumbnail: ''
  },
  {
    title: 'Coloration of the Grand Canal',
    artist: 'Nicolas Garcia Uriburu',
    type: 'Environmental Intervention',
    location: 'Venice, Italy',
    year: 1968,
    coordinates: [12.3155, 45.4408],
    description: 'A public water-coloration action using fluorescent dye to call attention to water pollution, ecological visibility, and urban waterways.',
    topics: ['Water Pollution', 'River Conservation', 'Environmental Awareness', 'Urban Pollution'],
    artform: ['Performance', 'Public Intervention', 'Eco-Art'],
    url: 'https://www.malba.org.ar/evento/nicolas-garcia-uriburu/',
    thumbnail: ''
  },
  {
    title: 'Revival Field',
    artist: 'Mel Chin',
    type: 'Ecological Installation',
    location: 'St. Paul, USA',
    year: 1991,
    coordinates: [-93.0899, 44.9537],
    description: 'A phytoremediation artwork testing plants that absorb heavy metals from contaminated soil, merging ecological restoration and conceptual art.',
    topics: ['Toxic Waste', 'Soil', 'Pollution', 'Environmental Health'],
    artform: ['Installation', 'Ecological Art', 'Research-based Art'],
    url: 'https://melchin.org/oeuvre/revival-field/',
    thumbnail: ''
  },
  {
    title: 'The Living Water Garden',
    artist: 'Betsy Damon',
    type: 'Public Ecological Artwork',
    location: 'Chengdu, China',
    year: 1998,
    coordinates: [104.0668, 30.5728],
    description: 'A public park and water-cleaning artwork designed with natural filtration systems to restore awareness of urban water ecologies.',
    topics: ['Water Management', 'Water Conservation', 'Urban Ecology', 'Public Health'],
    artform: ['Public Art', 'Ecological Design', 'Installation'],
    url: 'https://www.keepersofthewaters.org/',
    thumbnail: ''
  },
  {
    title: 'Beijing Besieged by Waste',
    artist: 'Wang Jiuliang',
    type: 'Photography / Documentary',
    location: 'Beijing, China',
    year: 2008,
    coordinates: [116.4074, 39.9042],
    description: 'A documentary photography project mapping informal landfill sites around Beijing and exposing the scale of urban waste and pollution.',
    topics: ['Waste Management', 'Landfill Issues', 'Urban Pollution', 'Environmental Awareness'],
    artform: ['Photography', 'Documentary', 'Research-based Art'],
    url: 'https://www.wangjiuliang.com/',
    thumbnail: ''
  },
  {
    title: 'The Sovereign Forest',
    artist: 'Amar Kanwar',
    type: 'Film / Installation',
    location: 'Odisha, India',
    year: 2012,
    coordinates: [85.0985, 20.9517],
    description: 'A long-form installation on land rights, seed sovereignty, mining, forests, and ecological justice in Odisha.',
    topics: ['Environmental Justice', 'Resource Extraction', 'Forest Conservation', 'Food Systems'],
    artform: ['Film', 'Installation', 'Research-based Art'],
    url: 'https://www.amar-kanwar.com/projects/the-sovereign-forest',
    thumbnail: ''
  },
  {
    title: 'Have You Seen the Flowers on the River?',
    artist: 'Ravi Agarwal',
    type: 'Photography / Installation',
    location: 'Delhi, India',
    year: 2007,
    coordinates: [77.1025, 28.7041],
    description: 'A project engaging the Yamuna River, urban pollution, ecological memory, and the social life of water in Delhi.',
    topics: ['Water Pollution', 'River Conservation', 'Urban Pollution', 'Environmental Justice'],
    artform: ['Photography', 'Installation', 'Public Art'],
    url: 'https://raviagarwal.com/',
    thumbnail: ''
  },
  {
    title: 'Pictures of Garbage',
    artist: 'Vik Muniz',
    type: 'Photography / Assemblage',
    location: 'Rio de Janeiro, Brazil',
    year: 2008,
    coordinates: [-43.1729, -22.9068],
    description: 'Portraits made with recyclable material in collaboration with landfill waste pickers, addressing waste economies, recycling, and dignity.',
    topics: ['Waste Management', 'Recycling', 'Environmental Justice', 'Consumerism'],
    artform: ['Photography', 'Assemblage', 'Social Practice'],
    url: 'https://vikmuniz.net/gallery/pictures-of-garbage',
    thumbnail: ''
  },
  {
    title: 'PETS',
    artist: 'Eduardo Srur',
    type: 'Public Installation',
    location: 'Sao Paulo, Brazil',
    year: 2008,
    coordinates: [-46.6333, -23.5505],
    description: 'Large inflatable plastic bottles installed in the Tiete River to confront urban water pollution and plastic waste.',
    topics: ['Plastic Pollution', 'Water Pollution', 'Urban Pollution', 'Environmental Awareness'],
    artform: ['Public Art', 'Installation', 'Environmental Intervention'],
    url: 'https://www.eduardosrur.com.br/',
    thumbnail: ''
  },
  {
    title: 'La Bouche du Roi',
    artist: 'Romuald Hazoume',
    type: 'Installation',
    location: 'Porto-Novo, Benin',
    year: 1997,
    coordinates: [2.6323, 6.4969],
    description: 'An installation using petrol cans to connect waste, resource extraction, colonial histories, and contemporary environmental harm.',
    topics: ['Plastic Waste', 'Resource Extraction', 'Colonial Histories', 'Environmental Justice'],
    artform: ['Installation', 'Assemblage', 'Sculpture'],
    url: 'https://www.britishmuseum.org/collection/object/E_Af2007-20-1',
    thumbnail: ''
  },
  {
    title: 'Acid Rain',
    artist: 'Bright Ugochukwu Eke',
    type: 'Installation',
    location: 'Port Harcourt, Nigeria',
    year: 2005,
    coordinates: [7.0498, 4.8156],
    description: 'An installation of suspended water-filled bags responding to oil extraction, acid rain, industrial pollution, and environmental vulnerability in the Niger Delta.',
    topics: ['Oil Pollution', 'Industrial Emissions', 'Environmental Justice', 'Water Pollution'],
    artform: ['Installation', 'Sculpture', 'Eco-Art'],
    url: 'https://www.contemporaryand.com/magazines/bright-ugochukwu-eke/',
    thumbnail: ''
  },
  {
    title: 'In Pursuit of Bling',
    artist: 'Otobong Nkanga',
    type: 'Installation / Performance',
    location: 'Namibia',
    year: 2014,
    coordinates: [18.4904, -22.9576],
    description: 'A research-led work tracing minerals, desire, extraction, and landscapes, linking resource depletion to global commodity circuits.',
    topics: ['Resource Extraction', 'Resource Depletion', 'Environmental Justice', 'Colonial Histories'],
    artform: ['Installation', 'Performance', 'Research-based Art'],
    url: 'https://www.otobongnkanga.com/',
    thumbnail: ''
  },
  {
    title: '1001st Island - The Most Sustainable Island in Archipelago',
    artist: 'Tita Salina',
    type: 'Public Intervention',
    location: 'Jakarta, Indonesia',
    year: 2015,
    coordinates: [106.8456, -6.2088],
    description: 'A floating island made from plastic waste that addresses coastal urbanization, sea-level rise, plastic pollution, and informal economies.',
    topics: ['Plastic Waste', 'Sea Level Rise', 'Urban Pollution', 'Climate Change'],
    artform: ['Public Art', 'Installation', 'Environmental Intervention'],
    url: 'https://titasalina.com/',
    thumbnail: ''
  },
  {
    title: 'Deep Breathing: Resuscitation for the Reef',
    artist: 'Janet Laurence',
    type: 'Installation',
    location: 'Sydney, Australia',
    year: 2015,
    coordinates: [151.2093, -33.8688],
    description: 'An immersive installation responding to coral bleaching and reef fragility through laboratory aesthetics, care, and ecological mourning.',
    topics: ['Coral Bleaching', 'Ocean Conservation', 'Climate Change', 'Marine Ecosystems'],
    artform: ['Installation', 'Mixed Media', 'Eco-Art'],
    url: 'https://www.janetlaurence.com/',
    thumbnail: ''
  },
  {
    title: 'What Is Missing?',
    artist: 'Maya Lin',
    type: 'Memorial / Digital Archive',
    location: 'New York, USA',
    year: 2009,
    coordinates: [-73.968, 40.785],
    description: 'A multi-platform memorial to species and habitat loss, collecting stories of biodiversity, extinction, conservation, and ecological memory.',
    topics: ['Biodiversity Loss', 'Extinction', 'Habitat Loss', 'Wildlife Conservation'],
    artform: ['Digital Art', 'Memorial', 'Public Art'],
    url: 'https://www.whatismissing.org/',
    thumbnail: ''
  },
  {
    title: 'Ghost Nets',
    artist: 'Aviva Rahmani',
    type: 'Ecological Restoration / Performance',
    location: 'Vinalhaven, USA',
    year: 1990,
    coordinates: [-68.8317, 44.0481],
    description: 'A restoration-based art project addressing degraded coastal habitat, marine life, community stewardship, and ecological repair.',
    topics: ['Marine Conservation', 'Marine Life', 'Habitat Loss', 'Ecosystem Protection'],
    artform: ['Performance', 'Ecological Art', 'Restoration Art'],
    url: 'https://ghostnets.com/',
    thumbnail: ''
  },
  {
    title: 'Seeds of Change',
    artist: 'Maria Thereza Alves',
    type: 'Research-based Installation',
    location: 'Bristol, United Kingdom',
    year: 1999,
    coordinates: [-2.5879, 51.4545],
    description: 'A research project tracing ballast seeds and colonial trade routes, connecting botany, migration, urban nature, and environmental histories.',
    topics: ['Biodiversity', 'Colonial Histories', 'Urban Nature', 'Cultural Heritage'],
    artform: ['Installation', 'Research-based Art', 'Public Art'],
    url: 'https://www.mariatherezaalves.org/works/seeds-of-change',
    thumbnail: ''
  },
  {
    title: 'Ice Watch',
    artist: 'Olafur Eliasson and Minik Rosing',
    type: 'Public Installation',
    location: 'Copenhagen, Denmark',
    year: 2014,
    coordinates: [12.5683, 55.6761],
    description: 'Blocks of Greenland ice installed in public space to make glacier retreat, global warming, and climate urgency physically present.',
    topics: ['Climate Change', 'Glacier Retreat', 'Climate Awareness', 'Urgency'],
    artform: ['Public Art', 'Installation', 'Environmental Intervention'],
    url: 'https://olafureliasson.net/artwork/ice-watch-2014/',
    thumbnail: ''
  },
  {
    title: 'A Project to Reclaim the River',
    artist: 'Lilian Ball',
    type: 'Wetland Public Art',
    location: 'New York, USA',
    year: 1997,
    coordinates: [-73.9442, 40.6782],
    description: 'A public ecological artwork focused on constructed wetlands, stormwater, habitat restoration, and urban water systems.',
    topics: ['Wetlands', 'Water Management', 'Urban Ecology', 'Ecosystem Protection'],
    artform: ['Public Art', 'Ecological Design', 'Installation'],
    url: 'https://lilianball.com/',
    thumbnail: ''
  },
  {
    title: 'Greenhouse Britain',
    artist: 'Helen Mayer Harrison and Newton Harrison',
    type: 'Ecological Mapping / Installation',
    location: 'London, United Kingdom',
    year: 2007,
    coordinates: [-0.1276, 51.5072],
    description: 'A Harrison Studio project mapping sea-level rise and climate futures for Britain, combining ecological planning, cartography, and public environmental imagination.',
    topics: ['Climate Change', 'Sea Level Rise', 'Landscape Change'],
    artform: ['Installation', 'Printmaking', 'Cartography'],
    url: 'https://www.moma.org/collection/works/200480',
    thumbnail: ''
  }
];

const existing = new Set(
  (data.features || []).map(feature => {
    const props = feature.properties || {};
    return `${props.title || ''}::${props.artist || ''}::${props.year || ''}`.toLowerCase();
  })
);

let added = 0;
for (const item of curatedArtworks) {
  const key = `${item.title}::${item.artist}::${item.year}`.toLowerCase();
  if (existing.has(key)) continue;
  data.features.push({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: item.coordinates
    },
    properties: {
      title: item.title,
      description: item.description,
      artist: item.artist,
      type: item.type,
      location: item.location,
      year: item.year,
      tags: {
        topic: item.topics,
        artform: item.artform
      },
      url: item.url,
      thumbnail: item.thumbnail,
      review: {
        status: 'published',
        human_verified: true,
        review_note: 'Curated regional artwork expansion, September 2026.'
      }
    }
  });
  existing.add(key);
  added += 1;
}

fs.writeFileSync(artworkPath, `${JSON.stringify(data, null, 4)}\n`, 'utf8');
console.log(`Curated artworks appended: ${added}`);
