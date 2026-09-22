PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS publications (
    id INTEGER PRIMARY KEY,
    doi TEXT UNIQUE,
    normalized_doi TEXT UNIQUE,
    title TEXT NOT NULL,
    normalized_title TEXT NOT NULL,
    abstract TEXT,
    year INTEGER,
    publication_date TEXT,
    journal TEXT,
    publisher TEXT,
    url TEXT,
    publication_type TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_publications_title_year
ON publications(normalized_title, year);

CREATE TABLE IF NOT EXISTS raw_imports (
    id INTEGER PRIMARY KEY,
    source_name TEXT NOT NULL,
    source_record_id TEXT NOT NULL,
    retrieved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    raw_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_raw_imports_source
ON raw_imports(source_name, source_record_id);

CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY,
    publication_id INTEGER NOT NULL,
    source_name TEXT NOT NULL,
    source_record_id TEXT NOT NULL,
    retrieved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    raw_import_id INTEGER,
    raw_reference TEXT,
    FOREIGN KEY (publication_id) REFERENCES publications(id) ON DELETE CASCADE,
    FOREIGN KEY (raw_import_id) REFERENCES raw_imports(id) ON DELETE SET NULL,
    UNIQUE (publication_id, source_name, source_record_id)
);

CREATE TABLE IF NOT EXISTS authors (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    orcid TEXT UNIQUE,
    UNIQUE (name, orcid)
);

CREATE TABLE IF NOT EXISTS publication_authors (
    publication_id INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    author_order INTEGER NOT NULL,
    affiliation_raw TEXT,
    FOREIGN KEY (publication_id) REFERENCES publications(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE,
    PRIMARY KEY (publication_id, author_id, author_order)
);

CREATE TABLE IF NOT EXISTS topic_clusters (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT
);

CREATE TABLE IF NOT EXISTS topics (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    topic_cluster_id INTEGER NOT NULL,
    FOREIGN KEY (topic_cluster_id) REFERENCES topic_clusters(id) ON DELETE CASCADE,
    UNIQUE (name, topic_cluster_id)
);

CREATE TABLE IF NOT EXISTS publication_topics (
    publication_id INTEGER NOT NULL,
    topic_id INTEGER NOT NULL,
    raw_term TEXT,
    confidence REAL,
    classification_method TEXT NOT NULL,
    classification_version TEXT NOT NULL,
    classified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (publication_id) REFERENCES publications(id) ON DELETE CASCADE,
    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
    PRIMARY KEY (publication_id, topic_id, classification_method, classification_version)
);

CREATE TABLE IF NOT EXISTS study_areas (
    id INTEGER PRIMARY KEY,
    publication_id INTEGER NOT NULL,
    country TEXT,
    region TEXT,
    city TEXT,
    latitude REAL,
    longitude REAL,
    geographic_scope TEXT NOT NULL,
    confidence REAL,
    extraction_method TEXT NOT NULL,
    classification_version TEXT NOT NULL,
    extracted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (publication_id) REFERENCES publications(id) ON DELETE CASCADE,
    CHECK (geographic_scope IN ('local', 'city', 'regional', 'national', 'multi-country', 'continental', 'global', 'unknown')),
    CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)),
    CHECK (NOT (geographic_scope = 'global' AND (latitude IS NOT NULL OR longitude IS NOT NULL)))
);

CREATE INDEX IF NOT EXISTS idx_publication_topics_publication
ON publication_topics(publication_id);

CREATE INDEX IF NOT EXISTS idx_study_areas_publication
ON study_areas(publication_id);

CREATE INDEX IF NOT EXISTS idx_study_areas_country_scope
ON study_areas(country, geographic_scope);
