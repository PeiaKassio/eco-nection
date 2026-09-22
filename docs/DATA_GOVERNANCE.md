# Eco:nection Data Governance

This document defines the first lightweight governance rules for Eco:nection artwork data.

## Roles

In the current project phase, one person may hold multiple roles.

| Role | Responsibility |
| --- | --- |
| Contributor | Suggests new artworks or improvements. |
| Reviewer | Checks factual accuracy, source quality, taxonomy, and duplicates. |
| Data steward | Maintains the data model, validation rules, and taxonomy. |
| Admin | Publishes accepted records. |

## Submission Workflow

```text
Contributor
|
Submission issue
|
Automatic validation
|
needs_review
|
Human review
|
published
```

New submissions should start with:

```json
{
  "review": {
    "status": "needs_review",
    "human_verified": false
  }
}
```

After human review, the record may be changed to:

```json
{
  "review": {
    "status": "published",
    "human_verified": true
  }
}
```

## Publication Rules

A record can be published when these fields are present and usable:

- title,
- artist or responsible organisation,
- location,
- valid point coordinates,
- at least one topic,
- at least one artform.

Missing source URLs do not block publication, but they must be reported as provenance warnings so they can be fixed later.

Existing records without a `review` object are treated as published unless they are missing important required information.

## Source Rules

`properties.url` is the primary source URL.

New records should also include structured provenance:

```json
{
  "sources": [
    {
      "url": "https://example.org/artwork",
      "type": "source",
      "accessed_at": "2026-09-22"
    }
  ]
}
```

Preferred source types:

1. Official artist, project, institution, museum, gallery, publisher, or event page.
2. Recognised archive, catalogue, database, or cultural institution.
3. Reliable journalism or critical writing.
4. Other references, clearly marked for review.

If sources conflict, prefer official and primary sources, keep notes in the review issue, and do not silently overwrite uncertain facts.

## AI Use

AI should support the workflow, not act as an independent factual source.

Preferred flow:

```text
Source
|
AI-assisted extraction or summarisation
|
Structured proposal
|
Validation
|
Human review
|
Published record
```

AI-generated descriptions or classifications should be reviewed before publication. When field-level provenance is added later, AI-generated and Eco:nection-classified fields should be marked explicitly.

## Review Triggers

Mark a record as `needs_review` when any of these apply:

- required fields are missing,
- coordinates are missing, invalid, or look like placeholders,
- source information is missing or weak,
- year cannot be reduced to a numeric start year,
- topics are not present in `topicClusters.json`,
- topics appear to belong to multiple clusters,
- artform tags are unclear or too specific for filtering,
- possible duplicate records are found,
- source facts conflict.

## Taxonomy Rules

Topics should belong to one cluster in `data/topicClusters.json`.

Before editing taxonomy values, distinguish between:

- true duplicates,
- spelling or capitalization variants,
- synonyms,
- intentional conceptual overlap,
- problematic multiple assignment.

Do not automatically rewrite existing artwork topics during the audit phase. Record findings first, then migrate in a separate controlled step.

## Change Tracking

For now, Git history and GitHub issues are the change log.

Data changes should be made in small commits that explain:

- what data changed,
- why it changed,
- what source or review decision supports it.

## Quality Reports

Run the data validation with report output to create review lists:

```bash
node data/dataValidation.js --report
```

This writes:

- `data/reports/data-quality-findings.json`
- `data/reports/data-quality-findings.md`

The reports are review aids. They should not automatically rewrite artwork records.
