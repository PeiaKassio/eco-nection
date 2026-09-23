# eco:nection Science Pipeline

This directory establishes the SQLite-backed scientific-publication pipeline.
JSON files under `exports/` are generated frontend delivery artifacts, not the
source of truth.

## Source Of Truth

```text
OpenAlex / Crossref
  -> raw_imports
  -> publications + sources
  -> verified topics + verified study areas
  -> generated exports
  -> map / future analysis
```

The canonical database path is:

```text
data/science/science.db
```

`science.db` is generated locally and should not be hand-edited. The schema is
defined in `schema.sql`.

## Commands

Initialize the database and sync `data/topicClusters.json` into SQL:

```bash
python data/science/science_pipeline.py init-db
```

Import candidate publications from OpenAlex:

```bash
python data/science/science_pipeline.py ingest-openalex --query "climate change Germany" --from-year 2015 --to-year 2025 --max-pages 1
```

Import curated insight/basic-research candidates from OpenAlex:

```bash
python data/science/science_pipeline.py ingest-curated-openalex --from-year 2018 --to-year 2026 --country Germany --country Kenya --max-pages 1
```

Recompute automatic curation labels after tuning the filters:

```bash
python data/science/science_pipeline.py refresh-curated-classifications --replace --min-score 6
```

Enrich DOI-backed publications from Crossref:

```bash
python data/science/science_pipeline.py enrich-crossref
```

Attach verified classification data:

```bash
python data/science/science_pipeline.py add-topic --publication 1 --topic "Climate Change" --method manual --version science-topic-v1
python data/science/science_pipeline.py add-study-area --publication 1 --country Germany --geographic-scope national --method manual --version science-geo-v1
```

Generate the frontend export:

```bash
python data/science/science_pipeline.py export-map
```

Validate normalized science data:

```bash
python data/science/science_pipeline.py validate
```

## Methodological Rules

- Author affiliation is stored only as bibliographic metadata and must not be
  treated as study geography.
- Country-only or global studies do not receive invented coordinates.
- Country-only studies may use `countryDisplayAnchors.json` for frontend
  aggregate display only; these anchors are not stored as study-area precision.
- Global studies are exported separately in `globalRecords`.
- Publications may have many topics, many topic clusters, and many study areas.
- Raw API records are preserved in `raw_imports` before normalization.
- Deduplication prefers DOI, then source identifier, then normalized title plus
  year.
- Curated OpenAlex imports score for findings-oriented language such as impacts,
  mechanisms, resilience, vulnerability, evidence, and synthesis, while
  downranking method-first records such as datasets, benchmarks, software,
  algorithm, remote-sensing-method, or validation papers.
- Automatic topic and study-area labels are conservative metadata scaffolding.
  They should be treated as reviewable classifications, not as final scholarly
  interpretation.

## API Notes

The OpenAlex integration uses the `/works` endpoint with `search`, `filter`,
`select`, `page`, and `per_page` parameters. The Crossref enrichment uses
`/works/{doi}`. Both are intentionally thin wrappers around the public APIs so
raw responses remain available for later reprocessing.
