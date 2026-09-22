#!/usr/bin/env python3
"""SQLite-backed science ingestion/export tools for eco:nection.

The importer stores raw API records first, then normalized bibliographic fields.
Topic and study-area classification are explicit follow-up steps so the project
does not confuse author affiliation with study geography or fabricate locations.
"""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
import sys
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen


SCIENCE_DIR = Path(__file__).resolve().parent
DATA_DIR = SCIENCE_DIR.parent
ROOT_DIR = DATA_DIR.parent
DEFAULT_DB = SCIENCE_DIR / "science.db"
DEFAULT_SCHEMA = SCIENCE_DIR / "schema.sql"
DEFAULT_TOPIC_CLUSTERS = DATA_DIR / "topicClusters.json"
DEFAULT_CONTINENT_MAPPING = DATA_DIR / "continentMapping.json"
DEFAULT_DISPLAY_ANCHORS = SCIENCE_DIR / "countryDisplayAnchors.json"
DEFAULT_EXPORT = SCIENCE_DIR / "exports" / "science-map.json"
USER_AGENT = "eco-nection-science-pipeline/0.1 (https://github.com/PeiaKassio/eco-nection)"
CURATION_VERSION = "science-curation-v1"
FOUNDATION_RESEARCH_QUERIES = [
    "climate change impacts biodiversity",
    "climate change ecosystem resilience",
    "biodiversity loss ecosystem functioning",
    "plastic pollution marine ecosystems impacts",
    "air pollution environmental health",
    "water scarcity ecosystem resilience",
    "urban heat green space public health",
    "deforestation biodiversity loss",
    "carbon sequestration peatlands ecosystem",
    "environmental justice climate change",
    "indigenous knowledge biodiversity conservation",
    "coral bleaching ecosystem resilience",
    "soil carbon biodiversity agriculture",
    "renewable energy transition environmental impacts",
]
FOUNDATION_POSITIVE_TERMS = [
    "impact",
    "impacts",
    "effect",
    "effects",
    "driver",
    "drivers",
    "pattern",
    "patterns",
    "relationship",
    "relationships",
    "mechanism",
    "mechanisms",
    "feedback",
    "feedbacks",
    "response",
    "responses",
    "dynamics",
    "vulnerability",
    "resilience",
    "risk",
    "consequence",
    "consequences",
    "evidence",
    "loss",
    "change",
    "adaptation",
    "justice",
]
FOUNDATION_SYNTHESIS_TERMS = [
    "synthesis",
    "assessment",
    "meta analysis",
    "meta-analysis",
    "systematic review",
]
METHOD_NOISE_TERMS = [
    "algorithm",
    "benchmark",
    "bibliometric",
    "classification method",
    "data set",
    "database",
    "dataset",
    "deep learning",
    "framework for",
    "machine learning",
    "mapping method",
    "method development",
    "methodological",
    "protocol",
    "remote sensing method",
    "software",
    "toolkit",
    "validation of",
]
GLOBAL_SCOPE_TERMS = [
    "global",
    "globally",
    "worldwide",
    "planetary",
    "earth system",
]


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def connect(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def normalize_text(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").casefold()).strip()


def normalize_doi(value: Any) -> str | None:
    doi = str(value or "").strip()
    if not doi:
        return None
    doi = re.sub(r"^https?://(dx\.)?doi\.org/", "", doi, flags=re.I)
    doi = re.sub(r"^doi:\s*", "", doi, flags=re.I)
    doi = doi.strip().lower()
    return doi or None


def reconstruct_openalex_abstract(inverted_index: Any) -> str | None:
    if not isinstance(inverted_index, dict):
        return None
    positions: list[tuple[int, str]] = []
    for word, indexes in inverted_index.items():
        if isinstance(indexes, list):
            positions.extend((int(index), str(word)) for index in indexes if isinstance(index, int))
    if not positions:
        return None
    return " ".join(word for _, word in sorted(positions))


def init_db(db_path: Path, schema_path: Path, topic_clusters_path: Path) -> None:
    with closing(connect(db_path)) as conn:
        conn.executescript(schema_path.read_text(encoding="utf-8"))
        sync_topics(conn, topic_clusters_path)


def sync_topics(conn: sqlite3.Connection, topic_clusters_path: Path) -> None:
    topic_clusters = read_json(topic_clusters_path)
    for cluster_name, cluster in topic_clusters.items():
        conn.execute(
            """
            INSERT INTO topic_clusters(name, color)
            VALUES (?, ?)
            ON CONFLICT(name) DO UPDATE SET color = excluded.color
            """,
            (cluster_name, cluster.get("color")),
        )
        cluster_id = conn.execute(
            "SELECT id FROM topic_clusters WHERE name = ?",
            (cluster_name,),
        ).fetchone()["id"]
        for topic in cluster.get("topics", []):
            conn.execute(
                """
                INSERT OR IGNORE INTO topics(name, topic_cluster_id)
                VALUES (?, ?)
                """,
                (topic, cluster_id),
            )
    conn.commit()


def http_json(url: str) -> Any:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def insert_raw_import(
    conn: sqlite3.Connection,
    source_name: str,
    source_record_id: str,
    raw_record: dict[str, Any],
) -> int:
    cursor = conn.execute(
        """
        INSERT INTO raw_imports(source_name, source_record_id, retrieved_at, raw_json)
        VALUES (?, ?, ?, ?)
        """,
        (source_name, source_record_id, utc_now(), json.dumps(raw_record, ensure_ascii=False, sort_keys=True)),
    )
    return int(cursor.lastrowid)


def find_existing_publication(
    conn: sqlite3.Connection,
    normalized_doi: str | None,
    source_name: str,
    source_record_id: str,
    normalized_title: str,
    year: int | None,
) -> int | None:
    if normalized_doi:
        row = conn.execute(
            "SELECT id FROM publications WHERE normalized_doi = ?",
            (normalized_doi,),
        ).fetchone()
        if row:
            return int(row["id"])

    row = conn.execute(
        """
        SELECT publication_id
        FROM sources
        WHERE source_name = ? AND source_record_id = ?
        """,
        (source_name, source_record_id),
    ).fetchone()
    if row:
        return int(row["publication_id"])

    if normalized_title:
        row = conn.execute(
            """
            SELECT id
            FROM publications
            WHERE normalized_title = ? AND COALESCE(year, -1) = COALESCE(?, -1)
            """,
            (normalized_title, year),
        ).fetchone()
        if row:
            return int(row["id"])
    return None


def upsert_publication(
    conn: sqlite3.Connection,
    metadata: dict[str, Any],
    source_name: str,
    source_record_id: str,
    raw_import_id: int | None = None,
) -> int:
    title = str(metadata.get("title") or "").strip()
    if not title:
        raise ValueError("Publication title is required for normalized storage.")

    doi = metadata.get("doi")
    normalized_doi = normalize_doi(doi)
    year = metadata.get("year")
    year = int(year) if year not in (None, "") else None
    normalized_title = normalize_text(title)
    existing_id = find_existing_publication(conn, normalized_doi, source_name, source_record_id, normalized_title, year)

    values = {
        "doi": doi,
        "normalized_doi": normalized_doi,
        "title": title,
        "normalized_title": normalized_title,
        "abstract": metadata.get("abstract"),
        "year": year,
        "publication_date": metadata.get("publication_date"),
        "journal": metadata.get("journal"),
        "publisher": metadata.get("publisher"),
        "url": metadata.get("url"),
        "publication_type": metadata.get("publication_type"),
    }

    if existing_id is None:
        cursor = conn.execute(
            """
            INSERT INTO publications(
                doi, normalized_doi, title, normalized_title, abstract, year, publication_date,
                journal, publisher, url, publication_type, created_at, updated_at
            )
            VALUES (
                :doi, :normalized_doi, :title, :normalized_title, :abstract, :year,
                :publication_date, :journal, :publisher, :url, :publication_type,
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
            """,
            values,
        )
        publication_id = int(cursor.lastrowid)
    else:
        publication_id = existing_id
        conn.execute(
            """
            UPDATE publications
            SET
                doi = COALESCE(doi, :doi),
                normalized_doi = COALESCE(normalized_doi, :normalized_doi),
                abstract = COALESCE(abstract, :abstract),
                publication_date = COALESCE(publication_date, :publication_date),
                journal = COALESCE(journal, :journal),
                publisher = COALESCE(publisher, :publisher),
                url = COALESCE(url, :url),
                publication_type = COALESCE(publication_type, :publication_type),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = :publication_id
            """,
            {**values, "publication_id": publication_id},
        )

    conn.execute(
        """
        INSERT OR IGNORE INTO sources(publication_id, source_name, source_record_id, retrieved_at, raw_import_id, raw_reference)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (publication_id, source_name, source_record_id, utc_now(), raw_import_id, metadata.get("url")),
    )
    return publication_id


def normalize_openalex_work(work: dict[str, Any]) -> dict[str, Any]:
    primary_location = work.get("primary_location") if isinstance(work.get("primary_location"), dict) else {}
    source = primary_location.get("source") if isinstance(primary_location.get("source"), dict) else {}
    return {
        "doi": work.get("doi"),
        "title": work.get("title") or work.get("display_name"),
        "abstract": reconstruct_openalex_abstract(work.get("abstract_inverted_index")),
        "year": work.get("publication_year"),
        "publication_date": work.get("publication_date"),
        "journal": source.get("display_name"),
        "publisher": source.get("host_organization_name"),
        "url": primary_location.get("landing_page_url") or work.get("id"),
        "publication_type": work.get("type"),
    }


def build_openalex_params(args: argparse.Namespace, query: str) -> dict[str, Any]:
    filters = []
    if args.from_year:
        filters.append(f"from_publication_date:{args.from_year:04d}-01-01")
    if args.to_year:
        filters.append(f"to_publication_date:{args.to_year:04d}-12-31")

    params = {
        "search": query,
        "per_page": min(args.per_page, 100),
        "page": 1,
        "select": ",".join([
            "id",
            "doi",
            "title",
            "display_name",
            "publication_year",
            "publication_date",
            "type",
            "primary_location",
            "abstract_inverted_index",
        ]),
    }
    if filters:
        params["filter"] = ",".join(filters)
    if args.openalex_api_key:
        params["api_key"] = args.openalex_api_key
    return params


def ingest_openalex(args: argparse.Namespace) -> None:
    init_db(args.db, DEFAULT_SCHEMA, args.topic_clusters)
    params = build_openalex_params(args, args.query)

    imported = 0
    with closing(connect(args.db)) as conn:
        for page in range(1, args.max_pages + 1):
            params["page"] = page
            url = f"https://api.openalex.org/works?{urlencode(params)}"
            payload = http_json(url)
            results = payload.get("results", [])
            if not results:
                break
            for work in results:
                source_record_id = str(work.get("id") or "")
                if not source_record_id:
                    continue
                raw_import_id = insert_raw_import(conn, "OpenAlex", source_record_id, work)
                metadata = normalize_openalex_work(work)
                if not metadata.get("title"):
                    continue
                upsert_publication(conn, metadata, "OpenAlex", source_record_id, raw_import_id)
                imported += 1
            conn.commit()
    print(f"Imported or matched {imported} OpenAlex work(s).")


def phrase_in_text(text: str, phrase: str) -> bool:
    return normalize_text(phrase) in text


def score_research_foundation(metadata: dict[str, Any], topic_clusters: dict[str, Any]) -> tuple[int, list[str]]:
    text = normalize_text(f"{metadata.get('title')} {metadata.get('abstract')} {metadata.get('journal')}")
    reasons: list[str] = []
    score = 0

    matched_topics = [
        topic
        for cluster in topic_clusters.values()
        for topic in cluster.get("topics", [])
        if phrase_in_text(text, topic)
    ]
    if matched_topics:
        score += min(8, len(matched_topics) * 2)
        reasons.append(f"eco-topic-match:{len(matched_topics)}")

    positive_matches = [term for term in FOUNDATION_POSITIVE_TERMS if phrase_in_text(text, term)]
    if positive_matches:
        score += min(6, len(positive_matches))
        reasons.append(f"insight-language:{len(positive_matches)}")

    synthesis_matches = [term for term in FOUNDATION_SYNTHESIS_TERMS if phrase_in_text(text, term)]
    if synthesis_matches:
        score += 2
        reasons.append("synthesis")

    method_matches = [term for term in METHOD_NOISE_TERMS if phrase_in_text(text, term)]
    if method_matches:
        score -= min(8, len(method_matches) * 3)
        reasons.append(f"method-noise:{len(method_matches)}")

    publication_type = normalize_text(metadata.get("publication_type"))
    if publication_type in {"article", "review", "book chapter", "book"}:
        score += 1
    elif publication_type:
        score -= 1

    return score, reasons


def classify_publication_topics(
    conn: sqlite3.Connection,
    publication_id: int,
    metadata: dict[str, Any],
    topic_clusters: dict[str, Any],
    confidence: float,
) -> int:
    text = normalize_text(f"{metadata.get('title')} {metadata.get('abstract')} {metadata.get('journal')}")
    inserted = 0

    for cluster_name, cluster in topic_clusters.items():
        for topic in cluster.get("topics", []):
            if not phrase_in_text(text, topic):
                continue
            topic_row = conn.execute(
                """
                SELECT topics.id
                FROM topics
                JOIN topic_clusters ON topic_clusters.id = topics.topic_cluster_id
                WHERE topics.name = ? AND topic_clusters.name = ?
                """,
                (topic, cluster_name),
            ).fetchone()
            if not topic_row:
                continue
            conn.execute(
                """
                INSERT OR REPLACE INTO publication_topics(
                    publication_id, topic_id, raw_term, confidence, classification_method, classification_version, classified_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    publication_id,
                    int(topic_row["id"]),
                    topic,
                    confidence,
                    "auto-keyword",
                    CURATION_VERSION,
                    utc_now(),
                ),
            )
            inserted += 1
    return inserted


def infer_study_areas(
    conn: sqlite3.Connection,
    publication_id: int,
    metadata: dict[str, Any],
    continent_mapping: dict[str, str],
    max_countries: int,
    confidence: float,
) -> int:
    text = normalize_text(f"{metadata.get('title')} {metadata.get('abstract')}")
    matched_countries = [
        country
        for country in sorted(continent_mapping)
        if phrase_in_text(text, country)
    ]
    inserted = 0

    if matched_countries:
        scope = "national" if len(matched_countries) == 1 else "multi-country"
        for country in matched_countries[:max_countries]:
            existing = conn.execute(
                """
                SELECT id
                FROM study_areas
                WHERE publication_id = ? AND country = ? AND geographic_scope = ?
                """,
                (publication_id, country, scope),
            ).fetchone()
            if existing:
                continue
            conn.execute(
                """
                INSERT INTO study_areas(
                    publication_id, country, geographic_scope, confidence, extraction_method, classification_version, extracted_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (publication_id, country, scope, confidence, "auto-text", CURATION_VERSION, utc_now()),
            )
            inserted += 1
        return inserted

    if any(phrase_in_text(text, term) for term in GLOBAL_SCOPE_TERMS):
        existing = conn.execute(
            """
            SELECT id
            FROM study_areas
            WHERE publication_id = ? AND geographic_scope = 'global'
            """,
            (publication_id,),
        ).fetchone()
        if not existing:
            conn.execute(
                """
                INSERT INTO study_areas(
                    publication_id, geographic_scope, confidence, extraction_method, classification_version, extracted_at
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (publication_id, "global", confidence, "auto-text", CURATION_VERSION, utc_now()),
            )
            inserted += 1

    return inserted


def build_curated_queries(args: argparse.Namespace) -> list[str]:
    base_queries = args.query or FOUNDATION_RESEARCH_QUERIES
    countries = args.country or []
    if not countries:
        return base_queries

    queries = []
    for query in base_queries:
        queries.append(query)
        queries.extend(f"{query} {country}" for country in countries)
    return queries


def ingest_curated_openalex(args: argparse.Namespace) -> None:
    init_db(args.db, DEFAULT_SCHEMA, args.topic_clusters)
    topic_clusters = read_json(args.topic_clusters)
    continent_mapping = load_continent_mapping(args.continent_mapping)
    queries = build_curated_queries(args)
    imported = 0
    skipped = 0
    topic_links = 0
    study_areas = 0

    with closing(connect(args.db)) as conn:
        for query in queries:
            params = build_openalex_params(args, query)
            for page in range(1, args.max_pages + 1):
                params["page"] = page
                url = f"https://api.openalex.org/works?{urlencode(params)}"
                payload = http_json(url)
                results = payload.get("results", [])
                if not results:
                    break

                for work in results:
                    source_record_id = str(work.get("id") or "")
                    if not source_record_id:
                        continue
                    metadata = normalize_openalex_work(work)
                    if not metadata.get("title"):
                        continue
                    score, reasons = score_research_foundation(metadata, topic_clusters)
                    if score < args.min_score:
                        skipped += 1
                        continue

                    raw_import = {
                        **work,
                        "_ecoCuration": {
                            "query": query,
                            "score": score,
                            "reasons": reasons,
                            "version": CURATION_VERSION,
                        },
                    }
                    raw_import_id = insert_raw_import(conn, "OpenAlex", source_record_id, raw_import)
                    publication_id = upsert_publication(conn, metadata, "OpenAlex", source_record_id, raw_import_id)
                    confidence = min(0.95, max(0.55, 0.55 + (score / 20)))
                    topic_links += classify_publication_topics(conn, publication_id, metadata, topic_clusters, confidence)
                    study_areas += infer_study_areas(
                        conn,
                        publication_id,
                        metadata,
                        continent_mapping,
                        args.max_countries_per_work,
                        max(0.5, confidence - 0.1),
                    )
                    imported += 1
                conn.commit()

    print(
        "Curated OpenAlex import: "
        f"{imported} imported/matched, {skipped} skipped, "
        f"{topic_links} topic link(s), {study_areas} study area(s)."
    )


def normalize_crossref_work(message: dict[str, Any]) -> dict[str, Any]:
    date_parts = (
        message.get("published-print", {}).get("date-parts")
        or message.get("published-online", {}).get("date-parts")
        or message.get("published", {}).get("date-parts")
        or []
    )
    first_date = date_parts[0] if date_parts and isinstance(date_parts[0], list) else []
    year = first_date[0] if first_date else None
    publication_date = "-".join(str(part).zfill(2) for part in first_date) if first_date else None
    container_title = message.get("container-title") or []
    return {
        "doi": message.get("DOI"),
        "title": (message.get("title") or [""])[0],
        "abstract": message.get("abstract"),
        "year": year,
        "publication_date": publication_date,
        "journal": container_title[0] if container_title else None,
        "publisher": message.get("publisher"),
        "url": message.get("URL"),
        "publication_type": message.get("type"),
    }


def enrich_crossref(args: argparse.Namespace) -> None:
    init_db(args.db, DEFAULT_SCHEMA, args.topic_clusters)
    with closing(connect(args.db)) as conn:
        rows = conn.execute(
            "SELECT id, normalized_doi FROM publications WHERE normalized_doi IS NOT NULL ORDER BY id"
        ).fetchall()
        enriched = 0
        for row in rows:
            doi = row["normalized_doi"]
            url = f"https://api.crossref.org/works/{quote(doi, safe='')}"
            payload = http_json(url)
            message = payload.get("message") or {}
            if not message:
                continue
            raw_import_id = insert_raw_import(conn, "Crossref", doi, message)
            metadata = normalize_crossref_work(message)
            upsert_publication(conn, metadata, "Crossref", doi, raw_import_id)
            enriched += 1
        conn.commit()
    print(f"Enriched {enriched} DOI-backed publication(s) from Crossref.")


def resolve_publication_id(conn: sqlite3.Connection, value: str) -> int:
    if value.isdigit():
        row = conn.execute("SELECT id FROM publications WHERE id = ?", (int(value),)).fetchone()
    else:
        row = conn.execute("SELECT id FROM publications WHERE normalized_doi = ?", (normalize_doi(value),)).fetchone()
    if not row:
        raise ValueError(f"No publication found for {value!r}.")
    return int(row["id"])


def add_topic(args: argparse.Namespace) -> None:
    init_db(args.db, DEFAULT_SCHEMA, args.topic_clusters)
    with closing(connect(args.db)) as conn:
        publication_id = resolve_publication_id(conn, args.publication)
        if args.cluster:
            topic_row = conn.execute(
                """
                SELECT topics.id
                FROM topics
                JOIN topic_clusters ON topic_clusters.id = topics.topic_cluster_id
                WHERE topics.name = ? AND topic_clusters.name = ?
                """,
                (args.topic, args.cluster),
            ).fetchone()
        else:
            topic_row = conn.execute("SELECT id FROM topics WHERE name = ? ORDER BY id LIMIT 1", (args.topic,)).fetchone()
        if not topic_row:
            raise ValueError(f"Topic {args.topic!r} is not present in topicClusters.json.")
        conn.execute(
            """
            INSERT OR REPLACE INTO publication_topics(
                publication_id, topic_id, raw_term, confidence, classification_method, classification_version, classified_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                publication_id,
                int(topic_row["id"]),
                args.raw_term,
                args.confidence,
                args.method,
                args.version,
                utc_now(),
            ),
        )
        conn.commit()
    print(f"Added topic {args.topic!r} to publication {publication_id}.")


def add_study_area(args: argparse.Namespace) -> None:
    init_db(args.db, DEFAULT_SCHEMA, args.topic_clusters)
    latitude = args.latitude
    longitude = args.longitude
    if (latitude is None) != (longitude is None):
        raise ValueError("Latitude and longitude must either both be provided or both be omitted.")
    if args.geographic_scope == "global" and (latitude is not None or longitude is not None):
        raise ValueError("Global study areas must not have coordinates.")
    with closing(connect(args.db)) as conn:
        publication_id = resolve_publication_id(conn, args.publication)
        conn.execute(
            """
            INSERT INTO study_areas(
                publication_id, country, region, city, latitude, longitude, geographic_scope,
                confidence, extraction_method, classification_version, extracted_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                publication_id,
                args.country,
                args.region,
                args.city,
                latitude,
                longitude,
                args.geographic_scope,
                args.confidence,
                args.method,
                args.version,
                utc_now(),
            ),
        )
        conn.commit()
    print(f"Added {args.geographic_scope} study area to publication {publication_id}.")


def load_continent_mapping(path: Path) -> dict[str, str]:
    return read_json(path)


def load_display_anchors(path: Path) -> dict[str, dict[str, Any]]:
    return read_json(path) if path.exists() else {}


def validate_science(args: argparse.Namespace) -> int:
    findings: list[dict[str, Any]] = []
    continent_mapping = load_continent_mapping(args.continent_mapping)
    with closing(connect(args.db)) as conn:
        for row in conn.execute("SELECT id, title, year, normalized_doi FROM publications"):
            if not row["title"]:
                findings.append({"severity": "error", "code": "missing-title", "publication_id": row["id"]})
            if row["year"] is not None and (row["year"] < 1600 or row["year"] > 2100):
                findings.append({"severity": "warning", "code": "invalid-year", "publication_id": row["id"]})
            if row["normalized_doi"] and not re.match(r"^10\.\S+/.+", row["normalized_doi"]):
                findings.append({"severity": "warning", "code": "malformed-doi", "publication_id": row["id"]})

        for row in conn.execute("SELECT id FROM publications WHERE id NOT IN (SELECT publication_id FROM sources)"):
            findings.append({"severity": "error", "code": "missing-source-provenance", "publication_id": row["id"]})

        duplicate_rows = conn.execute(
            """
            SELECT normalized_doi, COUNT(*) AS count
            FROM publications
            WHERE normalized_doi IS NOT NULL
            GROUP BY normalized_doi
            HAVING COUNT(*) > 1
            """
        ).fetchall()
        for row in duplicate_rows:
            findings.append({"severity": "error", "code": "duplicate-doi", "doi": row["normalized_doi"], "count": row["count"]})

        for row in conn.execute("SELECT id, country, geographic_scope, latitude, longitude FROM study_areas"):
            if not row["geographic_scope"]:
                findings.append({"severity": "error", "code": "missing-geographic-scope", "study_area_id": row["id"]})
            if row["geographic_scope"] == "global" and (row["latitude"] is not None or row["longitude"] is not None):
                findings.append({"severity": "error", "code": "global-has-coordinates", "study_area_id": row["id"]})
            if row["country"] and row["country"] not in continent_mapping:
                findings.append({"severity": "warning", "code": "country-not-in-continent-mapping", "country": row["country"]})

    errors = sum(1 for finding in findings if finding["severity"] == "error")
    warnings = sum(1 for finding in findings if finding["severity"] == "warning")
    print(f"Science validation completed with {errors} error(s) and {warnings} warning(s).")
    for finding in findings:
        print(json.dumps(finding, ensure_ascii=False, sort_keys=True))
    return 1 if errors else 0


def collect_publication_topics(conn: sqlite3.Connection) -> dict[int, dict[str, set[str]]]:
    topics: dict[int, dict[str, set[str]]] = {}
    rows = conn.execute(
        """
        SELECT publication_topics.publication_id, topics.name AS topic, topic_clusters.name AS cluster
        FROM publication_topics
        JOIN topics ON topics.id = publication_topics.topic_id
        JOIN topic_clusters ON topic_clusters.id = topics.topic_cluster_id
        """
    ).fetchall()
    for row in rows:
        entry = topics.setdefault(int(row["publication_id"]), {"topics": set(), "clusters": set()})
        entry["topics"].add(row["topic"])
        entry["clusters"].add(row["cluster"])
    return topics


def export_map(args: argparse.Namespace) -> None:
    init_db(args.db, DEFAULT_SCHEMA, args.topic_clusters)
    continent_mapping = load_continent_mapping(args.continent_mapping)
    display_anchors = load_display_anchors(args.display_anchors)
    with closing(connect(args.db)) as conn:
        topic_lookup = collect_publication_topics(conn)
        rows = conn.execute(
            """
            SELECT
                publications.id AS publication_id,
                publications.title,
                publications.doi,
                publications.journal,
                publications.publisher,
                publications.url,
                publications.publication_type,
                publications.year,
                study_areas.id AS study_area_id,
                study_areas.country,
                study_areas.region,
                study_areas.city,
                study_areas.latitude,
                study_areas.longitude,
                study_areas.geographic_scope,
                study_areas.confidence,
                (
                    SELECT GROUP_CONCAT(DISTINCT sources.source_name)
                    FROM sources
                    WHERE sources.publication_id = publications.id
                ) AS source_names
            FROM publications
            JOIN study_areas ON study_areas.publication_id = publications.id
            ORDER BY publications.id, study_areas.id
            """
        ).fetchall()

    records: list[dict[str, Any]] = []
    non_placeable_records: list[dict[str, Any]] = []
    global_records: list[dict[str, Any]] = []
    missing_continent_countries: set[str] = set()

    for row in rows:
        country = row["country"]
        continent = continent_mapping.get(country) if country else None
        if country and not continent:
            missing_continent_countries.add(country)
        topic_entry = topic_lookup.get(int(row["publication_id"]), {"topics": set(), "clusters": set()})
        display_anchor = display_anchors.get(country or "")
        has_study_coordinates = row["latitude"] is not None and row["longitude"] is not None
        display_latitude = row["latitude"] if has_study_coordinates else display_anchor.get("latitude") if display_anchor else None
        display_longitude = row["longitude"] if has_study_coordinates else display_anchor.get("longitude") if display_anchor else None
        display_geometry_source = "study-area-coordinates" if has_study_coordinates else display_anchor.get("source") if display_anchor else None
        record = {
            "publicationId": row["publication_id"],
            "studyAreaId": row["study_area_id"],
            "title": row["title"],
            "doi": row["doi"],
            "journal": row["journal"],
            "publisher": row["publisher"],
            "url": row["url"],
            "publicationType": row["publication_type"],
            "sourceName": row["source_names"],
            "year": row["year"],
            "country": country,
            "continent": continent or "Other",
            "region": row["region"],
            "city": row["city"],
            "latitude": row["latitude"],
            "longitude": row["longitude"],
            "displayLatitude": display_latitude,
            "displayLongitude": display_longitude,
            "displayGeometrySource": display_geometry_source,
            "hasStudyCoordinates": has_study_coordinates,
            "geographicScope": row["geographic_scope"],
            "confidence": row["confidence"],
            "topics": sorted(topic_entry["topics"]),
            "topicClusters": sorted(topic_entry["clusters"]),
        }
        if row["geographic_scope"] == "global":
            global_records.append(record)
        elif display_latitude is not None and display_longitude is not None:
            records.append(record)
        else:
            non_placeable_records.append(record)

    payload = {
        "schemaVersion": "science-map-v1",
        "generatedAt": utc_now(),
        "records": records,
        "nonPlaceableRecords": non_placeable_records,
        "globalRecords": global_records,
        "warnings": [
            {
                "code": "country-not-in-continent-mapping",
                "countries": sorted(missing_continent_countries),
            }
        ] if missing_continent_countries else [],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {args.output}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Manage eco:nection science data.")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB)
    parser.add_argument("--topic-clusters", type=Path, default=DEFAULT_TOPIC_CLUSTERS)
    subparsers = parser.add_subparsers(dest="command", required=True)

    init_parser = subparsers.add_parser("init-db", help="Create the SQLite schema and sync topic taxonomy.")
    init_parser.add_argument("--schema", type=Path, default=DEFAULT_SCHEMA)

    openalex_parser = subparsers.add_parser("ingest-openalex", help="Import candidate works from OpenAlex.")
    openalex_parser.add_argument("--query", required=True)
    openalex_parser.add_argument("--from-year", type=int)
    openalex_parser.add_argument("--to-year", type=int)
    openalex_parser.add_argument("--per-page", type=int, default=25)
    openalex_parser.add_argument("--max-pages", type=int, default=1)
    openalex_parser.add_argument("--openalex-api-key")

    curated_parser = subparsers.add_parser(
        "ingest-curated-openalex",
        help="Import insight/basic-research-oriented OpenAlex candidates and auto-classify safe metadata.",
    )
    curated_parser.add_argument("--query", action="append", help="Curated search query. Defaults to built-in foundation profiles.")
    curated_parser.add_argument("--country", action="append", help="Also run each query with this country appended.")
    curated_parser.add_argument("--from-year", type=int)
    curated_parser.add_argument("--to-year", type=int)
    curated_parser.add_argument("--per-page", type=int, default=25)
    curated_parser.add_argument("--max-pages", type=int, default=1)
    curated_parser.add_argument("--min-score", type=int, default=5)
    curated_parser.add_argument("--max-countries-per-work", type=int, default=4)
    curated_parser.add_argument("--continent-mapping", type=Path, default=DEFAULT_CONTINENT_MAPPING)
    curated_parser.add_argument("--openalex-api-key")

    subparsers.add_parser("enrich-crossref", help="Enrich DOI-backed publications from Crossref.")

    topic_parser = subparsers.add_parser("add-topic", help="Attach a verified eco:nection topic to a publication.")
    topic_parser.add_argument("--publication", required=True, help="Publication id or DOI.")
    topic_parser.add_argument("--topic", required=True)
    topic_parser.add_argument("--cluster")
    topic_parser.add_argument("--raw-term")
    topic_parser.add_argument("--confidence", type=float)
    topic_parser.add_argument("--method", default="manual")
    topic_parser.add_argument("--version", default="science-topic-v1")

    area_parser = subparsers.add_parser("add-study-area", help="Attach a verified study area to a publication.")
    area_parser.add_argument("--publication", required=True, help="Publication id or DOI.")
    area_parser.add_argument("--country")
    area_parser.add_argument("--region")
    area_parser.add_argument("--city")
    area_parser.add_argument("--latitude", type=float)
    area_parser.add_argument("--longitude", type=float)
    area_parser.add_argument("--geographic-scope", required=True, choices=[
        "local", "city", "regional", "national", "multi-country", "continental", "global", "unknown",
    ])
    area_parser.add_argument("--confidence", type=float)
    area_parser.add_argument("--method", default="manual")
    area_parser.add_argument("--version", default="science-geo-v1")

    export_parser = subparsers.add_parser("export-map", help="Generate the lightweight frontend science map export.")
    export_parser.add_argument("--continent-mapping", type=Path, default=DEFAULT_CONTINENT_MAPPING)
    export_parser.add_argument("--display-anchors", type=Path, default=DEFAULT_DISPLAY_ANCHORS)
    export_parser.add_argument("--output", type=Path, default=DEFAULT_EXPORT)

    validate_parser = subparsers.add_parser("validate", help="Validate normalized science data.")
    validate_parser.add_argument("--continent-mapping", type=Path, default=DEFAULT_CONTINENT_MAPPING)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        if args.command == "init-db":
            init_db(args.db, args.schema, args.topic_clusters)
            print(f"Initialized {args.db}")
        elif args.command == "ingest-openalex":
            ingest_openalex(args)
        elif args.command == "ingest-curated-openalex":
            ingest_curated_openalex(args)
        elif args.command == "enrich-crossref":
            enrich_crossref(args)
        elif args.command == "add-topic":
            add_topic(args)
        elif args.command == "add-study-area":
            add_study_area(args)
        elif args.command == "export-map":
            export_map(args)
        elif args.command == "validate":
            return validate_science(args)
    except (HTTPError, URLError, sqlite3.Error, ValueError) as error:
        print(f"Science pipeline error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
