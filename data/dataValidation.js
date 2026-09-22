const fs = require('fs');
const path = require('path');

const dataDir = __dirname;
const artworkPath = path.join(dataDir, 'artwork-data.json');
const topicClustersPath = path.join(dataDir, 'topicClusters.json');
const reportsDir = path.join(dataDir, 'reports');
const reportJsonPath = path.join(reportsDir, 'data-quality-findings.json');
const reportMarkdownPath = path.join(reportsDir, 'data-quality-findings.md');

const STRICT_DATA_QUALITY = process.env.STRICT_DATA_QUALITY === '1';
const WRITE_REPORT = process.argv.includes('--report');
const IGNORED_HIGHLY_REUSED_COORDINATES = new Set([
    '[28.9784,41.0082]', // Istanbul has several intentionally city-level records.
    '[-74.006,40.7128]', // New York has several intentionally city-level records.
    '[-0.1276,51.5072]' // London has several intentionally city-level records.
]);

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function isHttpUrl(value) {
    if (!value) return false;

    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

function normalizeKey(value) {
    return (value || '')
        .toString()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function addFinding(findings, severity, code, message, artwork) {
    findings.push({
        severity,
        code,
        message,
        artwork: artwork?.properties?.title || artwork?.title || null
    });
}

function buildTopicIndex(topicClusters) {
    const topicIndex = new Map();

    Object.entries(topicClusters).forEach(([clusterName, cluster]) => {
        (cluster.topics || []).forEach(topic => {
            if (!topicIndex.has(topic)) topicIndex.set(topic, []);
            if (!topicIndex.get(topic).includes(clusterName)) {
                topicIndex.get(topic).push(clusterName);
            }
        });
    });

    return topicIndex;
}

function validateArtworkData(artworkData, topicClusters) {
    const findings = [];
    const topicIndex = buildTopicIndex(topicClusters);
    const seenArtworkKeys = new Map();
    const seenTopicsWithinCluster = new Set();
    const coordinateCounts = new Map();

    if (artworkData.type !== 'FeatureCollection') {
        addFinding(findings, 'error', 'invalid-feature-collection', 'Root `type` must be `FeatureCollection`.', artworkData);
    }

    if (!Array.isArray(artworkData.features)) {
        addFinding(findings, 'error', 'missing-features', '`features` must be an array.', artworkData);
        return findings;
    }

    Object.entries(topicClusters).forEach(([clusterName, cluster]) => {
        const clusterTopics = new Set();

        (cluster.topics || []).forEach(topic => {
            const clusterTopicKey = `${clusterName}::${topic}`;
            if (seenTopicsWithinCluster.has(clusterTopicKey) || clusterTopics.has(topic)) {
                findings.push({
                    severity: 'warning',
                    code: 'duplicate-topic-within-cluster',
                    message: `Topic "${topic}" appears more than once in cluster "${clusterName}".`,
                    artwork: null
                });
            }
            clusterTopics.add(topic);
            seenTopicsWithinCluster.add(clusterTopicKey);
        });
    });

    Array.from(topicIndex.entries())
        .filter(([, clusters]) => clusters.length > 1)
        .forEach(([topic, clusters]) => {
            findings.push({
                severity: 'warning',
                code: 'topic-in-multiple-clusters',
                message: `Topic "${topic}" appears in multiple clusters: ${clusters.join(', ')}.`,
                artwork: null
            });
        });

    artworkData.features.forEach((artwork, index) => {
        const label = `Feature #${index + 1}`;
        const properties = artwork.properties;

        if (artwork.type !== 'Feature') {
            addFinding(findings, 'error', 'invalid-feature-type', `${label} must have type "Feature".`, artwork);
        }

        if (!artwork.geometry || artwork.geometry.type !== 'Point') {
            addFinding(findings, 'error', 'invalid-geometry', `${label} must have Point geometry.`, artwork);
        }

        const coordinates = artwork.geometry?.coordinates;
        if (!Array.isArray(coordinates) || coordinates.length !== 2) {
            addFinding(findings, 'error', 'invalid-coordinates', `${label} must have [longitude, latitude] coordinates.`, artwork);
        } else {
            const [longitude, latitude] = coordinates;
            const coordinateKey = JSON.stringify(coordinates);
            coordinateCounts.set(coordinateKey, (coordinateCounts.get(coordinateKey) || 0) + 1);

            if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
                addFinding(findings, 'error', 'invalid-longitude', `${label} longitude must be between -180 and 180.`, artwork);
            }

            if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
                addFinding(findings, 'error', 'invalid-latitude', `${label} latitude must be between -90 and 90.`, artwork);
            }

            if (longitude === 0 && latitude === 0) {
                addFinding(findings, 'warning', 'possible-placeholder-coordinates', `${label} uses [0, 0], which may be a placeholder.`, artwork);
            }
        }

        if (!properties || typeof properties !== 'object') {
            addFinding(findings, 'error', 'missing-properties', `${label} must have a properties object.`, artwork);
            return;
        }

        ['title', 'artist', 'location'].forEach(field => {
            if (!properties[field] || typeof properties[field] !== 'string') {
                addFinding(findings, 'error', `missing-${field}`, `${label} must have a non-empty properties.${field} string.`, artwork);
            }
        });

        if (!properties.description || typeof properties.description !== 'string') {
            addFinding(findings, 'warning', 'missing-description', `${label} is missing a description.`, artwork);
        }

        if (!properties.type || typeof properties.type !== 'string') {
            addFinding(findings, 'warning', 'missing-display-type', `${label} is missing properties.type display text.`, artwork);
        }

        if (typeof properties.year === 'string') {
            addFinding(findings, 'warning', 'year-string', `${label} has a string year "${properties.year}". Use the numeric start year for future records.`, artwork);
        } else if (properties.year !== null && typeof properties.year !== 'number') {
            addFinding(findings, 'warning', 'year-invalid-type', `${label} has a year that is not a number, string, or null.`, artwork);
        }

        if (!properties.tags || typeof properties.tags !== 'object') {
            addFinding(findings, 'error', 'missing-tags', `${label} must have a properties.tags object.`, artwork);
            return;
        }

        if (!Array.isArray(properties.tags.topic) || properties.tags.topic.length === 0) {
            addFinding(findings, 'error', 'missing-topic-tags', `${label} must have at least one topic tag.`, artwork);
        } else {
            properties.tags.topic.forEach(topic => {
                if (!topicIndex.has(topic)) {
                    addFinding(findings, 'warning', 'topic-not-in-taxonomy', `Topic "${topic}" is used but not defined in topicClusters.json.`, artwork);
                }
            });
        }

        if (!Array.isArray(properties.tags.artform) || properties.tags.artform.length === 0) {
            addFinding(findings, 'error', 'missing-artform-tags', `${label} must have at least one artform tag.`, artwork);
        }

        const reviewStatus = properties.review && properties.review.status;
        const isPublished = reviewStatus !== 'needs_review';
        const hasSourceUrl = properties.url != null && properties.url !== '';
        if (!hasSourceUrl) {
            if (isPublished) {
                addFinding(findings, 'warning', 'missing-source-url', `${label} is published without a source URL.`, artwork);
            } else {
                addFinding(findings, 'warning', 'needs-review-missing-source-url', `${label} is marked needs_review and is missing a source URL.`, artwork);
            }
        } else if (hasSourceUrl && !isHttpUrl(properties.url)) {
            addFinding(findings, 'warning', 'invalid-source-url', `${label} source URL should use http:// or https://.`, artwork);
        }

        if (properties.thumbnail && !isHttpUrl(properties.thumbnail)) {
            addFinding(findings, 'warning', 'invalid-thumbnail-url', `${label} thumbnail should use http:// or https://.`, artwork);
        }

        const duplicateKey = [
            normalizeKey(properties.title),
            normalizeKey(properties.location),
            properties.year == null ? '' : normalizeKey(properties.year)
        ].join('|');

        if (seenArtworkKeys.has(duplicateKey)) {
            addFinding(findings, 'warning', 'possible-duplicate-artwork', `${label} duplicates title/location/year with "${seenArtworkKeys.get(duplicateKey)}".`, artwork);
        } else {
            seenArtworkKeys.set(duplicateKey, properties.title || label);
        }
    });

    Array.from(coordinateCounts.entries())
        .filter(([coordinates, count]) => count > 5 && !IGNORED_HIGHLY_REUSED_COORDINATES.has(coordinates))
        .forEach(([coordinates, count]) => {
            findings.push({
                severity: 'warning',
                code: 'highly-reused-coordinates',
                message: `Coordinates ${coordinates} are used by ${count} artworks. This may be intentional for exhibitions/cities or may need review.`,
                artwork: null
            });
        });

    return findings;
}

function printSummary(findings) {
    const errors = findings.filter(finding => finding.severity === 'error');
    const warnings = findings.filter(finding => finding.severity === 'warning');

    console.log(`Validation completed with ${errors.length} error(s) and ${warnings.length} warning(s).`);

    const grouped = findings.reduce((groups, finding) => {
        groups[finding.code] = groups[finding.code] || [];
        groups[finding.code].push(finding);
        return groups;
    }, {});

    Object.entries(grouped)
        .sort(([codeA], [codeB]) => codeA.localeCompare(codeB))
        .forEach(([code, items]) => {
            console.log(`\n${code}: ${items.length}`);
            items.slice(0, 20).forEach(item => {
                const artwork = item.artwork ? ` (${item.artwork})` : '';
                console.log(`- [${item.severity}]${artwork} ${item.message}`);
            });
            if (items.length > 20) {
                console.log(`- ... ${items.length - 20} more`);
            }
        });
}

function groupFindings(findings) {
    return findings.reduce((groups, finding) => {
        groups[finding.code] = groups[finding.code] || [];
        groups[finding.code].push(finding);
        return groups;
    }, {});
}

function writeReports(findings) {
    const errors = findings.filter(finding => finding.severity === 'error');
    const warnings = findings.filter(finding => finding.severity === 'warning');
    const grouped = groupFindings(findings);
    const generatedAt = new Date().toISOString();

    fs.mkdirSync(reportsDir, { recursive: true });

    fs.writeFileSync(reportJsonPath, JSON.stringify({
        generated_at: generatedAt,
        summary: {
            errors: errors.length,
            warnings: warnings.length,
            total: findings.length
        },
        groups: Object.fromEntries(
            Object.entries(grouped)
                .sort(([codeA], [codeB]) => codeA.localeCompare(codeB))
                .map(([code, items]) => [code, {
                    count: items.length,
                    severity: items[0]?.severity || null,
                    findings: items
                }])
        )
    }, null, 2));

    const lines = [
        '# Eco:nection Data Quality Findings',
        '',
        `Generated at: ${generatedAt}`,
        '',
        '## Summary',
        '',
        `- Errors: ${errors.length}`,
        `- Warnings: ${warnings.length}`,
        `- Total findings: ${findings.length}`,
        ''
    ];

    Object.entries(grouped)
        .sort(([codeA], [codeB]) => codeA.localeCompare(codeB))
        .forEach(([code, items]) => {
            lines.push(`## ${code}`);
            lines.push('');
            lines.push(`Count: ${items.length}`);
            lines.push('');
            items.forEach(item => {
                const artwork = item.artwork ? ` (${item.artwork})` : '';
                lines.push(`- [${item.severity}]${artwork} ${item.message}`);
            });
            lines.push('');
        });

    fs.writeFileSync(reportMarkdownPath, `${lines.join('\n')}\n`);

    console.log(`\nReports written:`);
    console.log(`- ${reportJsonPath}`);
    console.log(`- ${reportMarkdownPath}`);
}

try {
    const topicClusters = readJson(topicClustersPath);
    const artworkData = readJson(artworkPath);
    const findings = validateArtworkData(artworkData, topicClusters);
    const hasErrors = findings.some(finding => finding.severity === 'error');
    const hasWarnings = findings.some(finding => finding.severity === 'warning');

    printSummary(findings);

    if (WRITE_REPORT) {
        writeReports(findings);
    }

    if (hasErrors || (STRICT_DATA_QUALITY && hasWarnings)) {
        process.exit(1);
    }
} catch (error) {
    console.error('Validation Error:', error.message);
    process.exit(1);
}
