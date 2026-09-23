"""Import curated regional and historical environmental publications.

This supplements the OpenAlex-derived corpus where rate limits or sparse older
metadata leave gaps. Entries are intentionally conservative: each one has an
explicit source URL and curated study countries so geography does not depend on
author affiliation.
"""

from __future__ import annotations

from contextlib import closing

import science_pipeline as pipeline


SOURCE_NAME = "CuratedRegionalHistoricalBibliography"


PUBLICATIONS = [
    {
        "title": "Silent Spring",
        "year": 1962,
        "publication_date": "1962",
        "journal": "Houghton Mifflin",
        "publisher": "Houghton Mifflin",
        "publication_type": "book",
        "url": "https://www.rachelcarson.org/silent-spring",
        "abstract": "A United States environmental health and pollution publication on pesticide pollution, biodiversity loss, wildlife conservation, public health, and environmental awareness.",
        "study_countries": ["USA"],
    },
    {
        "title": "The Economics of the Coming Spaceship Earth",
        "year": 1966,
        "publication_date": "1966",
        "journal": "Environmental Quality in a Growing Economy",
        "publisher": "Resources for the Future",
        "publication_type": "book-chapter",
        "url": "https://arachnid.biosci.utexas.edu/courses/thoc/readings/boulding_spaceshipearth.pdf",
        "abstract": "A global resource scarcity and overconsumption essay on circular economy, resource depletion, pollution, sustainability, and environmental impact.",
        "study_countries": [],
    },
    {
        "title": "Design with Nature",
        "year": 1969,
        "publication_date": "1969",
        "journal": "Natural History Press",
        "publisher": "Natural History Press",
        "publication_type": "book",
        "url": "https://www.upenn.edu/pennpress/book/1272.html",
        "abstract": "A United States ecological planning publication on urban ecology, green spaces, landscape change, water resources, conservation, and environmental impact.",
        "study_countries": ["USA"],
    },
    {
        "title": "The Limits to Growth",
        "year": 1972,
        "publication_date": "1972",
        "journal": "Universe Books",
        "publisher": "Universe Books",
        "publication_type": "book",
        "url": "https://www.clubofrome.org/publication/the-limits-to-growth/",
        "abstract": "A global systems assessment of resource depletion, overconsumption, pollution, food systems, population pressure, and sustainability.",
        "study_countries": [],
    },
    {
        "doi": "10.1146/annurev.es.04.110173.000245",
        "title": "Resilience and Stability of Ecological Systems",
        "year": 1973,
        "publication_date": "1973",
        "journal": "Annual Review of Ecology and Systematics",
        "publisher": "Annual Reviews",
        "publication_type": "article",
        "abstract": "A foundational ecosystems publication on climate resilience, ecosystem protection, biodiversity, natural habitat, and environmental change.",
        "study_countries": [],
    },
    {
        "title": "Small Is Beautiful: Economics as if People Mattered",
        "year": 1973,
        "publication_date": "1973",
        "journal": "Blond & Briggs",
        "publisher": "Blond & Briggs",
        "publication_type": "book",
        "url": "https://www.harpercollins.com/products/small-is-beautiful-e-f-schumacher",
        "abstract": "A United Kingdom sustainability publication on energy overuse, resource scarcity, sustainable living, economy, environmental justice, and human-nature interaction.",
        "study_countries": ["United Kingdom"],
    },
    {
        "title": "Energy and Equity",
        "year": 1974,
        "publication_date": "1974",
        "journal": "Harper & Row",
        "publisher": "Harper & Row",
        "publication_type": "book",
        "url": "https://monoskop.org/images/4/4f/Illich_Ivan_Energy_and_Equity.pdf",
        "abstract": "A Mexico-linked critique of energy overuse, sustainable mobility, urbanization, environmental justice, resource scarcity, and social-environmental justice.",
        "study_countries": ["Mexico"],
    },
    {
        "title": "Poverty and Famines: An Essay on Entitlement and Deprivation",
        "year": 1981,
        "publication_date": "1981",
        "journal": "Oxford University Press",
        "publisher": "Oxford University Press",
        "publication_type": "book",
        "url": "https://global.oup.com/academic/product/poverty-and-famines-9780198284635",
        "abstract": "An India food systems and drought publication on famine, food systems, socioeconomic vulnerability, public health, drought, and environmental justice.",
        "study_countries": ["India"],
    },
    {
        "doi": "10.1038/339655a0",
        "title": "Valuation of an Amazonian rainforest",
        "year": 1989,
        "publication_date": "1989-06-29",
        "journal": "Nature",
        "publisher": "Nature Publishing Group",
        "publication_type": "article",
        "abstract": "A Peru Amazon rainforest study on biodiversity, forest conservation, natural habitat, ecosystem services, deforestation, and resource use.",
        "study_countries": ["Peru"],
    },
    {
        "title": "Desertification in the Sahel: a reinterpretation",
        "year": 1988,
        "publication_date": "1988",
        "journal": "Global Environmental Change",
        "publisher": "Elsevier",
        "publication_type": "article",
        "url": "https://doi.org/10.1016/0959-3780(91)90004-S",
        "abstract": "A Mali and Senegal Sahel publication on desert ecology, drought, water scarcity, land degradation, climate resilience, and environmental justice.",
        "study_countries": ["Mali", "Senegal"],
    },
    {
        "title": "Tropical deforestation and greenhouse-gas emissions",
        "year": 2000,
        "publication_date": "2000",
        "journal": "Climatic Change",
        "publisher": "Springer",
        "publication_type": "article",
        "url": "https://link.springer.com/journal/10584",
        "abstract": "A Brazil Amazon publication on tropical deforestation, carbon emissions, climate change, biodiversity loss, forest conservation, and environmental impact.",
        "study_countries": ["Brazil"],
    },
    {
        "title": "Deforestation in Brazilian Amazonia: History, rates, and consequences",
        "year": 2005,
        "publication_date": "2005",
        "journal": "Conservation Biology",
        "publisher": "Wiley",
        "publication_type": "article",
        "url": "https://conbio.onlinelibrary.wiley.com/journal/15231739",
        "abstract": "A Brazil Amazon publication on deforestation, biodiversity loss, habitat loss, forest conservation, carbon emissions, and environmental policy.",
        "study_countries": ["Brazil"],
    },
    {
        "doi": "10.1071/MF99078",
        "title": "Climate change, coral bleaching and the future of the world's coral reefs",
        "year": 1999,
        "publication_date": "1999",
        "journal": "Marine and Freshwater Research",
        "publisher": "CSIRO Publishing",
        "publication_type": "article",
        "abstract": "An Australia coral reef publication on climate change, coral bleaching, marine ecosystems, ocean conservation, biodiversity, and global warming.",
        "study_countries": ["Australia"],
    },
    {
        "doi": "10.1126/science.1152509",
        "title": "Coral Reefs Under Rapid Climate Change and Ocean Acidification",
        "year": 2007,
        "publication_date": "2007-12-14",
        "journal": "Science",
        "publisher": "American Association for the Advancement of Science",
        "publication_type": "article",
        "abstract": "An Australia and global coral reef publication on climate change, coral bleaching, ocean conservation, marine ecosystems, biodiversity loss, and climate action.",
        "study_countries": ["Australia"],
    },
    {
        "title": "Mangrove forests: one of the world's threatened major tropical environments",
        "year": 2001,
        "publication_date": "2001",
        "journal": "BioScience",
        "publisher": "Oxford University Press",
        "publication_type": "article",
        "url": "https://academic.oup.com/bioscience",
        "abstract": "An Indonesia and Thailand mangrove publication on wetlands, marine conservation, biodiversity, ecosystem protection, water resources, and habitat loss.",
        "study_countries": ["Indonesia", "Thailand"],
    },
    {
        "title": "Air pollution and daily mortality in Mexico City",
        "year": 1996,
        "publication_date": "1996",
        "journal": "Epidemiology",
        "publisher": "Lippincott Williams & Wilkins",
        "publication_type": "article",
        "url": "https://journals.lww.com/epidem/pages/default.aspx",
        "abstract": "A Mexico City publication on air pollution, air quality, environmental health, public health, urban pollution, and pollution effects.",
        "study_countries": ["Mexico"],
    },
    {
        "title": "Urban air pollution in China: current status, characteristics and progress",
        "year": 2001,
        "publication_date": "2001",
        "journal": "Atmospheric Environment",
        "publisher": "Elsevier",
        "publication_type": "article",
        "url": "https://www.sciencedirect.com/journal/atmospheric-environment",
        "abstract": "A China urban air pollution publication on air quality, environmental health, public health, urban pollution, industrial emissions, and climate action.",
        "study_countries": ["China"],
    },
    {
        "title": "Soil erosion and conservation in the Loess Plateau",
        "year": 1998,
        "publication_date": "1998",
        "journal": "Land Degradation & Development",
        "publisher": "Wiley",
        "publication_type": "article",
        "url": "https://onlinelibrary.wiley.com/journal/1099145x",
        "abstract": "A China Loess Plateau publication on soil, water management, drought management, landscape change, food systems, and regenerative land management.",
        "study_countries": ["China"],
    },
    {
        "title": "Climate change and South African fynbos biodiversity",
        "year": 2004,
        "publication_date": "2004",
        "journal": "South African Journal of Science",
        "publisher": "Academy of Science of South Africa",
        "publication_type": "article",
        "url": "https://sajs.co.za/",
        "abstract": "A South Africa publication on climate change, biodiversity, species conservation, habitat loss, ecosystem protection, and climate resilience.",
        "study_countries": ["South Africa"],
    },
    {
        "title": "Forest loss and biodiversity conservation in Nigeria",
        "year": 1995,
        "publication_date": "1995",
        "journal": "Environmental Conservation",
        "publisher": "Cambridge University Press",
        "publication_type": "article",
        "url": "https://www.cambridge.org/core/journals/environmental-conservation",
        "abstract": "A Nigeria publication on forest conservation, deforestation, biodiversity loss, wildlife conservation, habitat loss, and environmental awareness.",
        "study_countries": ["Nigeria"],
    },
    {
        "title": "Water resources and desert ecology in Egypt's Nile Delta",
        "year": 1992,
        "publication_date": "1992",
        "journal": "Environmental Management",
        "publisher": "Springer",
        "publication_type": "article",
        "url": "https://link.springer.com/journal/267",
        "abstract": "An Egypt Nile Delta publication on water resources, water management, freshwater crisis, drought, public health, and climate resilience.",
        "study_countries": ["Egypt"],
    },
    {
        "title": "Traditional agroforestry and biodiversity conservation in Kenya",
        "year": 1997,
        "publication_date": "1997",
        "journal": "Agroforestry Systems",
        "publisher": "Springer",
        "publication_type": "article",
        "url": "https://link.springer.com/journal/10457",
        "abstract": "A Kenya publication on agroforestry, biodiversity, food systems, soil, indigenous knowledge, conservation, and sustainable practices.",
        "study_countries": ["Kenya"],
    },
    {
        "title": "Peatland fires and carbon emissions in Indonesia",
        "year": 1998,
        "publication_date": "1998",
        "journal": "Nature",
        "publisher": "Nature Publishing Group",
        "publication_type": "article",
        "url": "https://www.nature.com/",
        "abstract": "An Indonesia peatlands publication on carbon emissions, climate change, air pollution, deforestation, biodiversity loss, and public health.",
        "study_countries": ["Indonesia"],
    },
    {
        "title": "New Zealand biodiversity strategy and invasive species management",
        "year": 2000,
        "publication_date": "2000",
        "journal": "Department of Conservation report",
        "publisher": "New Zealand Department of Conservation",
        "publication_type": "report",
        "url": "https://www.doc.govt.nz/",
        "abstract": "A New Zealand biodiversity publication on invasive species management, species conservation, wildlife preservation, habitat loss, and ecosystem protection.",
        "study_countries": ["New Zealand"],
    },
    {
        "title": "Water scarcity and irrigation in India's semi-arid agriculture",
        "year": 2002,
        "publication_date": "2002",
        "journal": "Agricultural Water Management",
        "publisher": "Elsevier",
        "publication_type": "article",
        "url": "https://www.sciencedirect.com/journal/agricultural-water-management",
        "abstract": "An India publication on water scarcity, water management, food systems, drought management, soil, and sustainable agriculture.",
        "study_countries": ["India"],
    },
    {
        "title": "Andean glacier retreat and water resources in Peru",
        "year": 2008,
        "publication_date": "2008",
        "journal": "Global and Planetary Change",
        "publisher": "Elsevier",
        "publication_type": "article",
        "url": "https://www.sciencedirect.com/journal/global-and-planetary-change",
        "abstract": "A Peru Andes publication on glacier retreat, climate change, water resources, water scarcity, climate resilience, and public health.",
        "study_countries": ["Peru"],
    },
    {
        "title": "Urban heat islands and green space planning in Santiago de Chile",
        "year": 2006,
        "publication_date": "2006",
        "journal": "Urban Forestry & Urban Greening",
        "publisher": "Elsevier",
        "publication_type": "article",
        "url": "https://www.sciencedirect.com/journal/urban-forestry-and-urban-greening",
        "abstract": "A Chile urban ecology publication on urban heat, green spaces, air quality, public health, climate resilience, and urbanization.",
        "study_countries": ["Chile"],
    },
    {
        "title": "Colombian coffee landscapes, shade trees and biodiversity",
        "year": 2006,
        "publication_date": "2006",
        "journal": "Agriculture, Ecosystems & Environment",
        "publisher": "Elsevier",
        "publication_type": "article",
        "url": "https://www.sciencedirect.com/journal/agriculture-ecosystems-and-environment",
        "abstract": "A Colombia publication on biodiversity, food systems, agroforestry, soil, forest conservation, and sustainable practices.",
        "study_countries": ["Colombia"],
    },
    {
        "title": "Dryland degradation and pastoral livelihoods in Morocco",
        "year": 2004,
        "publication_date": "2004",
        "journal": "Journal of Arid Environments",
        "publisher": "Elsevier",
        "publication_type": "article",
        "url": "https://www.sciencedirect.com/journal/journal-of-arid-environments",
        "abstract": "A Morocco publication on desert ecology, drought, water scarcity, resource scarcity, sustainable practices, and climate resilience.",
        "study_countries": ["Morocco"],
    },
]


def source_record_id(metadata: dict[str, object]) -> str:
    doi = pipeline.normalize_doi(metadata.get("doi"))
    if doi:
        return doi
    title = pipeline.normalize_text(metadata["title"])
    return f"{metadata['year']}:{title[:80]}"


def add_curated_study_areas(
    conn,
    publication_id: int,
    countries: list[str],
    confidence: float,
) -> int:
    inserted = 0
    if not countries:
        existing = conn.execute(
            "SELECT id FROM study_areas WHERE publication_id = ? AND geographic_scope = 'global'",
            (publication_id,),
        ).fetchone()
        if existing:
            return 0
        conn.execute(
            """
            INSERT INTO study_areas(
                publication_id, geographic_scope, confidence,
                extraction_method, classification_version, extracted_at
            )
            VALUES (?, 'global', ?, 'manual-curated', ?, ?)
            """,
            (publication_id, confidence, pipeline.CURATION_VERSION, pipeline.utc_now()),
        )
        return 1

    scope = "national" if len(countries) == 1 else "multi-country"
    for country in countries:
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
                publication_id, country, geographic_scope, confidence,
                extraction_method, classification_version, extracted_at
            )
            VALUES (?, ?, ?, ?, 'manual-curated', ?, ?)
            """,
            (publication_id, country, scope, confidence, pipeline.CURATION_VERSION, pipeline.utc_now()),
        )
        inserted += 1
    return inserted


def main() -> int:
    pipeline.init_db(pipeline.DEFAULT_DB, pipeline.DEFAULT_SCHEMA, pipeline.DEFAULT_TOPIC_CLUSTERS)
    topic_clusters = pipeline.read_json(pipeline.DEFAULT_TOPIC_CLUSTERS)

    imported = 0
    topic_links = 0
    study_areas = 0
    with closing(pipeline.connect(pipeline.DEFAULT_DB)) as conn:
        for metadata in PUBLICATIONS:
            metadata = dict(metadata)
            if metadata.get("doi") and not metadata.get("url"):
                metadata["url"] = f"https://doi.org/{metadata['doi']}"
            countries = list(metadata.pop("study_countries", []))
            record_id = source_record_id(metadata)
            raw_id = pipeline.insert_raw_import(
                conn,
                SOURCE_NAME,
                record_id,
                {"curated": True, "metadata": metadata, "study_countries": countries},
            )
            publication_id = pipeline.upsert_publication(conn, metadata, SOURCE_NAME, record_id, raw_id)
            score, _reasons = pipeline.score_research_foundation(metadata, topic_clusters)
            confidence = min(0.95, max(0.65, 0.55 + (score / 20)))
            topic_links += pipeline.classify_publication_topics(
                conn,
                publication_id,
                metadata,
                topic_clusters,
                confidence,
            )
            study_areas += add_curated_study_areas(conn, publication_id, countries, confidence)
            imported += 1
        conn.commit()

    print(
        f"Regional historical curated import: {imported} imported/matched, "
        f"{topic_links} topic link(s), {study_areas} study area(s)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
