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
        self.assertEqual(record["title"], "Climate Change in Germany")
        self.assertEqual(record["doi"], "10.1234/anchor")
        self.assertEqual(record["sourceName"], "OpenAlex")

    def test_foundation_scoring_downranks_method_noise(self):
        topic_clusters = science_pipeline.read_json(ROOT / "data" / "topicClusters.json")
        insight_score, insight_reasons = science_pipeline.score_research_foundation(
            {
                "title": "Climate Change Impacts on Biodiversity and Ecosystem Resilience",
                "abstract": "Evidence shows long-term effects, mechanisms, and adaptation responses.",
                "publication_type": "article",
            },
            topic_clusters,
        )
        method_score, method_reasons = science_pipeline.score_research_foundation(
            {
                "title": "A Deep Learning Benchmark Dataset for Remote Sensing Method Validation",
                "abstract": "This software toolkit describes an algorithm and database.",
                "publication_type": "article",
            },
            topic_clusters,
        )

        self.assertGreaterEqual(insight_score, 5)
        self.assertLess(method_score, insight_score)
        self.assertTrue(any(reason.startswith("method-noise") for reason in method_reasons))
        self.assertTrue(any(reason.startswith("eco-topic-match") for reason in insight_reasons))

    def test_phrase_matching_uses_word_boundaries(self):
        self.assertTrue(science_pipeline.phrase_in_text(science_pipeline.normalize_text("Studies in Mali"), "Mali"))
        self.assertFalse(science_pipeline.phrase_in_text(science_pipeline.normalize_text("abnormalities"), "Mali"))

    def test_auto_classification_links_topics_and_country_study_area(self):
        publication_id = science_pipeline.upsert_publication(
            self.conn,
            {
                "doi": "10.1234/curated",
                "title": "Biodiversity Loss and Ecosystem Resilience in Kenya",
                "abstract": "Evidence from Kenya shows impacts on biodiversity and conservation.",
                "year": 2024,
            },
            "OpenAlex",
            "W5",
        )
        topic_clusters = science_pipeline.read_json(ROOT / "data" / "topicClusters.json")
        continent_mapping = science_pipeline.load_continent_mapping(ROOT / "data" / "continentMapping.json")
        topic_links = science_pipeline.classify_publication_topics(
            self.conn,
            publication_id,
            {
                "title": "Biodiversity Loss and Ecosystem Resilience in Kenya",
                "abstract": "Evidence from Kenya shows impacts on biodiversity and conservation.",
            },
            topic_clusters,
            0.8,
        )
        study_areas = science_pipeline.infer_study_areas(
            self.conn,
            publication_id,
            {
                "title": "Biodiversity Loss and Ecosystem Resilience in Kenya",
                "abstract": "Evidence from Kenya shows impacts on biodiversity and conservation.",
            },
            continent_mapping,
            4,
            0.7,
        )
        self.conn.commit()

        clusters = {
            row[0]
            for row in self.conn.execute(
                """
                SELECT DISTINCT topic_clusters.name
                FROM publication_topics
                JOIN topics ON topics.id = publication_topics.topic_id
                JOIN topic_clusters ON topic_clusters.id = topics.topic_cluster_id
                WHERE publication_topics.publication_id = ?
                """,
                (publication_id,),
            )
        }
        area = self.conn.execute(
            "SELECT country, geographic_scope FROM study_areas WHERE publication_id = ?",
            (publication_id,),
        ).fetchone()

        self.assertGreaterEqual(topic_links, 2)
        self.assertGreaterEqual(study_areas, 1)
        self.assertIn("Biodiversity", clusters)
        self.assertIn("Ecosystems", clusters)
        self.assertEqual(area["country"], "Kenya")
        self.assertEqual(area["geographic_scope"], "national")


if __name__ == "__main__":
    unittest.main()
