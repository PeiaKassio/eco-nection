# Eco:nection Canonical Data Model v1

This document defines the current data contract and the smallest backwards-compatible target model for Eco:nection artwork records.

## Current Legacy Contract

The current repository stores artworks in `data/artwork-data.json` as a GeoJSON `FeatureCollection`.

This GeoJSON shape is a real application contract. The map, globe, filters, analysis views, submission preview, and validation logic all read the structure directly.

```text
FeatureCollection
+-- features[]
    +-- Feature
        +-- type
        +-- geometry
        |   +-- type
        |   +-- coordinates
        +-- properties
            +-- title
            +-- description
            +-- artist
            +-- type
            +-- location
            +-- year
            +-- tags
            |   +-- topic
            |   +-- artform
            |   +-- cluster
            +-- url
            +-- thumbnail
```

The canonical model v1 remains GeoJSON-compatible. Eco:nection-specific artwork metadata lives inside `properties`.

## Required Fields

For a publishable artwork record, these fields are required:

| JSON path | Type | Notes |
| --- | --- | --- |
| `features[].type` | string | Must be `Feature`. |
| `features[].geometry.type` | string | Must be `Point`. |
| `features[].geometry.coordinates` | array | `[longitude, latitude]`, both finite numbers. |
| `features[].properties.title` | string | Non-empty display title. |
| `features[].properties.artist` | string | Non-empty artist, collective, author, or organisation name. |
| `features[].properties.location` | string | Human-readable location. |
| `features[].properties.tags.topic` | string array | At least one environmental topic. |
| `features[].properties.tags.artform` | string array | At least one controlled artform tag. |

## Optional Legacy Fields

These fields are currently used by the application and should remain backwards-compatible:

| JSON path | Type | Notes |
| --- | --- | --- |
| `features[].properties.description` | string | Display/search text. Source or AI origin is not currently encoded. |
| `features[].properties.type` | string | Human-readable display type. This may be more specific than `tags.artform`. |
| `features[].properties.year` | number or null | New records should use the numeric start year. Legacy records may still contain strings during migration. |
| `features[].properties.url` | string or null | Primary source URL. Kept for backwards compatibility. |
| `features[].properties.thumbnail` | string or null | Image URL for display. |
| `features[].properties.tags.cluster` | string array | Rare legacy field. Do not rely on it; clusters are derived from topics. |

## Canonical Additions

New records should add these optional fields without removing legacy fields:

```json
{
  "properties": {
    "url": "https://example.org/artwork",
    "sources": [
      {
        "url": "https://example.org/artwork",
        "type": "source",
        "accessed_at": "2026-09-22"
      }
    ],
    "review": {
      "status": "needs_review",
      "human_verified": false
    }
  }
}
```

### `sources`

`properties.url` is treated as the primary source URL. `properties.sources[]` is the structured provenance form.

Allowed source fields:

| Field | Type | Notes |
| --- | --- | --- |
| `url` | string | HTTP(S) URL. |
| `type` | string | `source`, `official`, `reference`, `image`, or `other`. |
| `accessed_at` | string or null | ISO date `YYYY-MM-DD` when known. |

### `review`

Eco:nection uses a deliberately small status model:

| Status | Meaning |
| --- | --- |
| `needs_review` | Record or important field needs human review. |
| `published` | Record can be used in the public application. |

`verified` is not a separate status in v1. A verified record is considered `published`.

Existing records without `review` are treated as `published` unless important required information is missing.

## Year Policy

New records should store only the numeric start year in `properties.year`.

Examples:

| Source wording | Canonical `year` |
| --- | --- |
| `2005-ongoing` | `2005` |
| `Ongoing since 2019` | `2019` |
| `1979-1980` | `1979` |
| Unknown | `null` |

If end years or ongoing status become important later, add separate fields such as `year_end` and `is_ongoing` instead of overloading `year`.

## Topic and Artform Taxonomies

Topics should map to exactly one topic cluster in `data/topicClusters.json`.

Taxonomy overlaps should be reviewed before changing data. They may be:

- true duplicates,
- synonyms,
- intentional domain overlap,
- problematic multiple assignment.

`properties.type` and `properties.tags.artform` have different jobs:

- `properties.type` is display text and may be specific, such as `Sculpture / Installation`.
- `properties.tags.artform` is controlled taxonomy data used for filtering and analysis, such as `["Sculpture", "Installation"]`.

Do not merge these fields in v1.
