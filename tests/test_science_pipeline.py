import sqlite3
import sys
import tempfile
import unittest
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "data" / "science"))

import science_pipeline


class SciencePipelineTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Path(self.tmp.name) / "science.db"
        science_pipeline.init_db(
            self.db,
            ROOT / "data" / "science" / "schema.sql",
            ROOT / "data" / "topicClusters.json",
        )
        self.conn = science_pipeline.connect(self.db)

    def tearDown(self):
        self.conn.close()
        self.tmp.cleanup()

    def test_deduplicates_by_doi_and_preserves_sources(self):
        first = science_pipeline.upsert_publication(
            self.conn,
            {"doi": "https://doi.org/10.1234/example", "title": "Climate Study", "year": 2020},
            "OpenAlex",
            "W1",
        )
        second = science_pipeline.upsert_publication(
            self.conn,
            {"doi": "10.1234/EXAMPLE", "title": "Climate Study", "year": 2020, "publisher": "Publisher"},
            "Crossref",
            "10.1234/example",
        )
        self.conn.commit()

        self.assertEqual(first, second)
        publication_count = self.conn.execute("SELECT COUNT(*) FROM publications").fetchone()[0]
        source_count = self.conn.execute("SELECT COUNT(*) FROM sources").fetchone()[0]
        self.assertEqual(publication_count, 1)
        self.assertEqual(source_count, 2)

    def test_publication_can_have_multiple_topics_and_clusters(self):
        publication_id = science_pipeline.upsert_publication(
            self.conn,
            {"doi": "10.1234/topics", "title": "Plastic Waste and Marine Biodiversity", "year": 2021},
            "OpenAlex",
            "W2",
        )
        for topic_name in ["Plastic Waste", "Marine Ecosystems", "Biodiversity"]:
            topic_id = self.conn.execute(
                "SELECT id FROM topics WHERE name = ? ORDER BY id LIMIT 1",
                (topic_name,),
            ).fetchone()[0]
            self.conn.execute(
                """
                INSERT INTO publication_topics(
                    publication_id, topic_id, raw_term, confidence, classification_method, classification_version
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (publication_id, topic_id, topic_name, 1.0, "manual", "test"),
            )
        self.conn.commit()

        rows = self.conn.execute(
            """
            SELECT DISTINCT topic_clusters.name
            FROM publication_topics
            JOIN topics ON topics.id = publication_topics.topic_id
            JOIN topic_clusters ON topic_clusters.id = topics.topic_cluster_id
            WHERE publication_topics.publication_id = ?
            """,
            (publication_id,),
        ).fetchall()
        clusters = {row[0] for row in rows}
        self.assertGreaterEqual(len(clusters), 3)

    def test_global_study_area_cannot_have_coordinates(self):
        publication_id = science_pipeline.upsert_publication(
            self.conn,
            {"doi": "10.1234/global", "title": "Global Climate Review", "year": 2022},
            "OpenAlex",
            "W3",
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute(
                """
                INSERT INTO study_areas(
                    publication_id, latitude, longitude, geographic_scope, extraction_method, classification_version
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (publication_id, 0, 0, "global", "manual", "test"),
            )

    def test_country_display_anchor_does_not_become_study_coordinates(self):
        publication_id = science_pipeline.upsert_publication(
            self.conn,
            {"doi": "10.1234/anchor", "title": "Climate Change in Germany", "year": 2023},
            "OpenAlex",
            "W4",
        )
        topic_id = self.conn.execute(
            "SELECT id FROM topics WHERE name = ? ORDER BY id LIMIT 1",
            ("Climate Change",),
        ).fetchone()[0]
        self.conn.execute(
            """
            INSERT INTO publication_topics(
                publication_id, topic_id, raw_term, confidence, classification_method, classification_version
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (publication_id, topic_id, "climate change", 1.0, "manual", "test"),
        )
        self.conn.execute(
            """
            INSERT INTO study_areas(
                publication_id, country, geographic_scope, extraction_method, classification_version
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            (publication_id, "Germany", "national", "manual", "test"),
        )
        self.conn.commit()

        output = Path(self.tmp.name) / "science-map.json"
        args = type("Args", (), {
            "db": self.db,
            "topic_clusters": ROOT / "data" / "topicClusters.json",
            "continent_mapping": ROOT / "data" / "continentMapping.json",
            "display_anchors": ROOT / "data" / "science" / "countryDisplayAnchors.json",
            "output": output,
        })()
        science_pipeline.export_map(args)
        payload = json.loads(output.read_text(encoding="utf-8"))

        self.assertEqual(len(payload["records"]), 1)
        record = payload["records"][0]
        self.assertIsNone(record["latitude"])
        self.assertIsNone(record["longitude"])
        self.assertFalse(record["hasStudyCoordinates"])
        self.assertEqual(record["displayGeometrySource"], "display-anchor-country-centroid")
        self.assertIsInstance(record["displayLatitude"], float)
        self.assertIsInstance(record["displayLongitude"], float)


if __name__ == "__main__":
    unittest.main()
