const REPOSITORY_ISSUES_URL = 'https://github.com/PeiaKassio/eco-nection/issues/new';

let existingArtworks = [];
let topicClusters = {};
let allTopics = [];
let allArtforms = [];

function normalizeText(value) {
    return (value || '')
        .toString()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function splitList(value) {
    return (value || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
}

function getCheckedValues(name) {
    return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`))
        .map(input => input.value);
}

function getFormData() {
    const longitude = document.getElementById('longitude').value;
    const latitude = document.getElementById('latitude').value;
    const year = document.getElementById('year').value.trim();

    return {
        title: document.getElementById('title').value.trim(),
        artist: document.getElementById('artist').value.trim(),
        artform: getCheckedValues('artformOption'),
        proposedArtforms: splitList(document.getElementById('proposedArtforms').value),
        year: year === '' ? '' : Number(year),
        location: document.getElementById('location').value.trim(),
        country: document.getElementById('country').value.trim(),
        longitude: longitude === '' ? null : parseFloat(longitude),
        latitude: latitude === '' ? null : parseFloat(latitude),
        topics: getCheckedValues('topicOption'),
        proposedTopics: splitList(document.getElementById('proposedTopics').value),
        description: document.getElementById('description').value.trim(),
        url: document.getElementById('url').value.trim(),
        thumbnail: document.getElementById('thumbnail').value.trim(),
        submitter: document.getElementById('submitter').value.trim()
    };
}

function buildArtworkFeature(data) {
    const hasCoordinates = Number.isFinite(data.longitude) && Number.isFinite(data.latitude);
    const artforms = [...data.artform, ...data.proposedArtforms];
    const topics = [...data.topics, ...data.proposedTopics];

    return {
        type: 'Feature',
        geometry: {
            type: 'Point',
            coordinates: hasCoordinates ? [data.longitude, data.latitude] : []
        },
        properties: {
            title: data.title,
            description: data.description,
            artist: data.artist,
            type: artforms[0] || '',
            location: data.location,
            country: data.country,
            year: data.year || '',
            tags: {
                topic: topics,
                artform: artforms
            },
            url: data.url,
            thumbnail: data.thumbnail
        }
    };
}

function getDuplicateScore(candidate, artwork) {
    const props = artwork.properties || {};
    const titleMatch = normalizeText(candidate.title) === normalizeText(props.title);
    const artistMatch = normalizeText(candidate.artist) === normalizeText(props.artist);
    const urlMatch = candidate.url && props.url && candidate.url === props.url;
    const locationMatch = normalizeText(candidate.location) === normalizeText(props.location);
    const yearMatch = candidate.year && props.year && Number(candidate.year) === Number(props.year);

    let score = 0;
    if (urlMatch) score += 5;
    if (titleMatch) score += 3;
    if (artistMatch) score += 2;
    if (locationMatch) score += 1;
    if (yearMatch) score += 1;

    return score;
}

function findDuplicates(candidate) {
    if (!candidate.title && !candidate.url) return [];

    return existingArtworks
        .map(artwork => ({
            artwork,
            score: getDuplicateScore(candidate, artwork)
        }))
        .filter(result => result.score >= 4)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
}

function setDuplicateStatus(matches) {
    const status = document.getElementById('duplicateStatus');

    if (matches.length === 0) {
        status.className = 'alert alert-success mb-5';
        status.innerHTML = '<i class="ti ti-circle-check text-xl"></i><span>No likely duplicates found.</span>';
        return;
    }

    const items = matches.map(({ artwork, score }) => {
        const props = artwork.properties || {};
        return `<li><strong>${props.title || 'Untitled'}</strong> by ${props.artist || 'Unknown'} (${props.year || 'n.d.'}) - score ${score}</li>`;
    }).join('');

    status.className = 'alert alert-warning mb-5';
    status.innerHTML = `
        <i class="ti ti-alert-triangle text-xl"></i>
        <div>
            <div class="font-semibold">Possible duplicate found</div>
            <ul class="list-disc ml-5 mt-2">${items}</ul>
        </div>
    `;
}

function updatePreview() {
    const data = getFormData();
    const feature = buildArtworkFeature(data);
    document.getElementById('jsonPreview').textContent = JSON.stringify(feature, null, 2);
}

function isHttpUrl(value) {
    if (!value) return true;

    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

function validateSubmission(data) {
    const messages = [];

    if (!data.title) messages.push('title is required');
    if (!data.artist) messages.push('artist is required');
    if (!data.location) messages.push('location is required');
    if (document.getElementById('year').value.trim() && !Number.isFinite(data.year)) {
        messages.push('year should be numeric');
    }
    if (!isHttpUrl(data.url)) messages.push('source URL should start with http:// or https://');
    if (!isHttpUrl(data.thumbnail)) messages.push('thumbnail URL should start with http:// or https://');

    return messages;
}

function buildIssueUrl(data, matches) {
    const feature = buildArtworkFeature(data);
    const coordinateNote = feature.geometry.coordinates.length === 0
        ? 'Coordinates need curator review.'
        : 'Coordinates were provided by the submitter.';
    const duplicateNote = matches.length === 0
        ? 'No likely duplicates found by the client-side check.'
        : matches.map(({ artwork, score }) => {
            const props = artwork.properties || {};
            return `- ${props.title || 'Untitled'} by ${props.artist || 'Unknown'} (${props.year || 'n.d.'}), score ${score}`;
        }).join('\n');
    const taxonomyNote = [
        data.proposedTopics.length > 0 ? `**Proposed new topics:** ${data.proposedTopics.join(', ')}` : '**Proposed new topics:** None',
        data.proposedArtforms.length > 0 ? `**Proposed new art forms:** ${data.proposedArtforms.join(', ')}` : '**Proposed new art forms:** None',
        data.proposedTopics.length > 0 ? 'New topics need curator review and may require `topicClusters.json` updates before merging.' : ''
    ].filter(Boolean).join('\n');

    const title = `Artwork submission: ${data.title}`;
    const body = `## Artwork submission

**Title:** ${data.title}
**Artist:** ${data.artist}
**Year:** ${data.year || 'Needs review'}
**Location:** ${data.location}
**Country:** ${data.country || 'Not provided'}
**Submitter:** ${data.submitter || 'Not provided'}

**Source URL:** ${data.url}
**Thumbnail URL:** ${data.thumbnail || 'Not provided'}

**Coordinate status:** ${coordinateNote}

## Duplicate check

${duplicateNote}

## Taxonomy review

**Selected existing topics:** ${data.topics.join(', ') || 'None'}
**Selected existing art forms:** ${data.artform.join(', ') || 'None'}
${taxonomyNote}

## Curator-ready JSON

\`\`\`json
${JSON.stringify(feature, null, 2)}
\`\`\`
`;

    const params = new URLSearchParams({
        title,
        body,
        labels: 'artwork-submission'
    });

    return `${REPOSITORY_ISSUES_URL}?${params.toString()}`;
}

function handleDuplicateCheck() {
    const matches = findDuplicates(getFormData());
    setDuplicateStatus(matches);
}

async function handleCopyJson() {
    const json = document.getElementById('jsonPreview').textContent;
    const status = document.getElementById('duplicateStatus');

    try {
        await navigator.clipboard.writeText(json);
        status.className = 'alert alert-success mb-5';
        status.innerHTML = '<i class="ti ti-circle-check text-xl"></i><span>Generated JSON copied to clipboard.</span>';
    } catch {
        status.className = 'alert alert-warning mb-5';
        status.innerHTML = '<i class="ti ti-alert-triangle text-xl"></i><span>Could not copy automatically. Select the generated JSON and copy it manually.</span>';
    }
}

function handleCreateIssue() {
    const data = getFormData();
    const missing = validateSubmission(data);

    if (missing.length > 0) {
        const status = document.getElementById('duplicateStatus');
        status.className = 'alert alert-error mb-5';
        status.innerHTML = `<i class="ti ti-alert-circle text-xl"></i><span>Please review: ${missing.join(', ')}.</span>`;
        return;
    }

    const matches = findDuplicates(data);
    setDuplicateStatus(matches);
    window.open(buildIssueUrl(data, matches), '_blank', 'noopener,noreferrer');
}

function createCheckboxOption(name, value, color) {
    const id = `${name}-${normalizeText(value).replace(/\s+/g, '-')}`;
    const label = document.createElement('label');
    label.className = 'submission-option';
    label.dataset.label = normalizeText(value);
    label.innerHTML = `
        <input id="${id}" type="checkbox" name="${name}" value="${value}" class="checkbox checkbox-primary checkbox-sm">
        <span class="submission-option-swatch" style="--option-color: ${color || 'currentColor'}"></span>
        <span>${value}</span>
    `;
    label.querySelector('input').addEventListener('change', updatePreview);
    return label;
}

function renderOptionList(containerId, values, name, colorByValue = {}) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    values.forEach(value => {
        container.appendChild(createCheckboxOption(name, value, colorByValue[value]));
    });
}

function filterTopicOptions() {
    const query = normalizeText(document.getElementById('topicSearch').value);
    document.querySelectorAll('#topicOptions .submission-option').forEach(option => {
        option.hidden = query && !option.dataset.label.includes(query);
    });
}

function populateOptions() {
    const topics = new Set();
    const artforms = new Set();
    const topicColors = {};

    Object.entries(topicClusters).forEach(([, cluster]) => {
        (cluster.topics || []).forEach(topic => {
            topics.add(topic);
            topicColors[topic] = cluster.color;
        });
    });

    existingArtworks.forEach(artwork => {
        (artwork.properties?.tags?.artform || []).forEach(artform => artforms.add(artform));
    });

    allTopics = Array.from(topics).sort();
    allArtforms = Array.from(artforms).sort();
    renderOptionList('topicOptions', allTopics, 'topicOption', topicColors);
    renderOptionList('artformOptions', allArtforms, 'artformOption');
}

async function loadSubmissionData() {
    const [artworkResponse, topicResponse] = await Promise.all([
        fetch('data/artwork-data.json'),
        fetch('data/topicClusters.json')
    ]);

    const artworkData = await artworkResponse.json();
    topicClusters = await topicResponse.json();
    existingArtworks = artworkData.features || [];
    populateOptions();
    updatePreview();
}

document.getElementById('artworkSubmissionForm').addEventListener('input', updatePreview);
document.getElementById('topicSearch').addEventListener('input', filterTopicOptions);
document.getElementById('artworkSubmissionForm').addEventListener('reset', () => {
    setTimeout(() => {
        updatePreview();
        document.getElementById('duplicateStatus').className = 'alert mb-5';
        document.getElementById('duplicateStatus').innerHTML = '<i class="ti ti-info-circle text-xl"></i><span>Fill in the form to check for similar existing artworks.</span>';
    }, 0);
});
document.getElementById('checkDuplicatesButton').addEventListener('click', handleDuplicateCheck);
document.getElementById('copyJsonButton').addEventListener('click', handleCopyJson);
document.getElementById('createIssueButton').addEventListener('click', handleCreateIssue);

loadSubmissionData().catch(error => {
    const status = document.getElementById('duplicateStatus');
    status.className = 'alert alert-error mb-5';
    status.innerHTML = `<i class="ti ti-alert-circle text-xl"></i><span>Could not load artwork data: ${error.message}</span>`;
});
