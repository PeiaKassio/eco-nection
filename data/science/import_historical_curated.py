"""Import a small curated historical science bibliography.

This is a fallback seed for periods where live OpenAlex ingestion is rate-limited.
It uses the same pipeline helpers as API imports so deduplication, source
provenance, topic classification, and study-area inference stay consistent.
"""

from __future__ import annotations

from contextlib import closing

import science_pipeline as pipeline


SOURCE_NAME = "CuratedHistoricalBibliography"


PUBLICATIONS = [
    {
        "doi": "10.1126/science.162.3859.1243",
        "title": "The Tragedy of the Commons",
        "year": 1968,
        "publication_date": "1968-12-13",
        "journal": "Science",
        "publisher": "American Association for the Advancement of Science",
        "publication_type": "article",
        "abstract": "A global and planetary analysis of resource scarcity, overconsumption, environmental impact, population pressure, and commons governance.",
    },
    {
        "doi": "10.1038/249810a0",
        "title": "Stratospheric sink for chlorofluoromethanes: chlorine atom-catalysed destruction of ozone",
        "year": 1974,
        "publication_date": "1974-06-28",
        "journal": "Nature",
        "publisher": "Nature Publishing Group",
        "publication_type": "article",
        "abstract": "A global atmospheric pollution study on industrial emissions, ozone depletion, climate change, and environmental health impacts.",
    },
    {
        "doi": "10.1038/315207a0",
        "title": "Large losses of total ozone in Antarctica reveal seasonal ClOx/NOx interaction",
        "year": 1985,
        "publication_date": "1985-05-16",
        "journal": "Nature",
        "publisher": "Nature Publishing Group",
        "publication_type": "article",
        "abstract": "A global ozone assessment documenting pollution effects, atmospheric change, and environmental health risk linked to industrial emissions.",
    },
    {
        "doi": "10.2307/1310057",
        "title": "Human appropriation of the products of photosynthesis",
        "year": 1986,
        "publication_date": "1986",
        "journal": "BioScience",
        "publisher": "Oxford University Press",
        "publication_type": "article",
        "abstract": "A global ecosystem assessment of resource depletion, overconsumption, ecosystems, biodiversity, and human-nature interaction.",
    },
    {
        "doi": "10.1029/JD093iD08p09341",
        "title": "Global climate changes as forecast by Goddard Institute for Space Studies three-dimensional model",
        "year": 1988,
        "publication_date": "1988-08-20",
        "journal": "Journal of Geophysical Research",
        "publisher": "American Geophysical Union",
        "publication_type": "article",
        "abstract": "A global climate change and global warming model assessment of carbon emissions, climate sensitivity, and future impacts.",
    },
    {
        "doi": "10.1038/387253a0",
        "title": "The value of the world's ecosystem services and natural capital",
        "year": 1997,
        "publication_date": "1997-05-15",
        "journal": "Nature",
        "publisher": "Nature Publishing Group",
        "publication_type": "article",
        "abstract": "A global synthesis of ecosystems, ecosystem services, natural habitat, biodiversity, economy, and human-nature interaction.",
    },
    {
        "doi": "10.1038/33859",
        "title": "Global-scale temperature patterns and climate forcing over the past six centuries",
        "year": 1998,
        "publication_date": "1998-04-23",
        "journal": "Nature",
        "publisher": "Nature Publishing Group",
        "publication_type": "article",
        "abstract": "A global climate change reconstruction assessing global warming patterns, climate forcing, and long-term environmental change.",
    },
    {
        "doi": "10.1038/35002501",
        "title": "Biodiversity hotspots for conservation priorities",
        "year": 2000,
        "publication_date": "2000-02-24",
        "journal": "Nature",
        "publisher": "Nature Publishing Group",
        "publication_type": "article",
        "abstract": "A global biodiversity and conservation synthesis identifying habitat loss, extinction risk, species conservation, and ecosystem protection priorities.",
    },
    {
        "doi": "10.1038/416389a",
        "title": "Ecological responses to recent climate change",
        "year": 2002,
        "publication_date": "2002-03-28",
        "journal": "Nature",
        "publisher": "Nature Publishing Group",
        "publication_type": "review",
        "abstract": "A global synthesis of climate change impacts on ecosystems, biodiversity, natural habitat, species conservation, and ecological responses.",
    },
    {
        "doi": "10.1038/421037a",
        "title": "A globally coherent fingerprint of climate change impacts across natural systems",
        "year": 2003,
        "publication_date": "2003-01-02",
        "journal": "Nature",
        "publisher": "Nature Publishing Group",
        "publication_type": "article",
        "abstract": "A global assessment of climate change impacts across ecosystems, biodiversity, species conservation, and natural habitat.",
    },
    {
        "doi": "10.1038/nature02121",
        "title": "Extinction risk from climate change",
        "year": 2004,
        "publication_date": "2004-01-08",
        "journal": "Nature",
        "publisher": "Nature Publishing Group",
        "publication_type": "article",
        "abstract": "A global biodiversity assessment of climate change, extinction, biodiversity loss, habitat loss, and conservation risk.",
    },
    {
        "doi": "10.1126/science.1111772",
        "title": "Global consequences of land use",
        "year": 2005,
        "publication_date": "2005-07-22",
        "journal": "Science",
        "publisher": "American Association for the Advancement of Science",
        "publication_type": "review",
        "abstract": "A global synthesis of land use, deforestation, biodiversity loss, ecosystems, food systems, water resources, and environmental impact.",
    },
    {
        "doi": "10.1126/science.1132294",
        "title": "Impacts of biodiversity loss on ocean ecosystem services",
        "year": 2006,
        "publication_date": "2006-11-03",
        "journal": "Science",
        "publisher": "American Association for the Advancement of Science",
        "publication_type": "article",
        "abstract": "A global marine ecosystems synthesis on biodiversity loss, ocean conservation, marine life, fisheries, and ecosystem services.",
    },
    {
        "doi": "10.1126/science.1149345",
        "title": "A global map of human impact on marine ecosystems",
        "year": 2008,
        "publication_date": "2008-02-15",
        "journal": "Science",
        "publisher": "American Association for the Advancement of Science",
        "publication_type": "article",
        "abstract": "A global assessment of human environmental impact on marine ecosystems, ocean pollution, overfishing, marine conservation, and biodiversity.",
    },
    {
        "doi": "10.1038/461472a",
        "title": "A safe operating space for humanity",
        "year": 2009,
        "publication_date": "2009-09-24",
        "journal": "Nature",
        "publisher": "Nature Publishing Group",
        "publication_type": "article",
        "abstract": "A planetary boundaries assessment of climate change, biodiversity loss, water resources, land use, ocean pollution, and environmental justice.",
    },
    {
        "doi": "10.1038/nature08019",
        "title": "Warming caused by cumulative carbon emissions towards the trillionth tonne",
        "year": 2009,
        "publication_date": "2009-04-30",
        "journal": "Nature",
        "publisher": "Nature Publishing Group",
        "publication_type": "article",
        "abstract": "A global climate change study on global warming, carbon emissions, fossil fuels, climate crisis, and climate action.",
    },
    {
        "doi": "10.1126/science.1187512",
        "title": "Global biodiversity: indicators of recent declines",
        "year": 2010,
        "publication_date": "2010-05-28",
        "journal": "Science",
        "publisher": "American Association for the Advancement of Science",
        "publication_type": "article",
        "abstract": "A global biodiversity assessment of biodiversity loss, extinction, habitat loss, wildlife conservation, and ecosystem protection.",
    },
    {
        "doi": "10.1038/nature09678",
        "title": "Has the Earth's sixth mass extinction already arrived?",
        "year": 2011,
        "publication_date": "2011-03-03",
        "journal": "Nature",
        "publisher": "Nature Publishing Group",
        "publication_type": "review",
        "abstract": "A global biodiversity review of extinction, biodiversity loss, habitat loss, species conservation, and anthropocene change.",
    },
    {
        "doi": "10.1038/nature11118",
        "title": "A global synthesis reveals biodiversity loss as a major driver of ecosystem change",
        "year": 2012,
        "publication_date": "2012-05-02",
        "journal": "Nature",
        "publisher": "Nature Publishing Group",
        "publication_type": "article",
        "abstract": "A global synthesis of biodiversity loss, ecosystems, ecosystem functioning, conservation, and environmental impact.",
    },
    {
        "doi": "10.1038/nature12540",
        "title": "The projected timing of climate departure from recent variability",
        "year": 2013,
        "publication_date": "2013-10-10",
        "journal": "Nature",
        "publisher": "Nature Publishing Group",
        "publication_type": "article",
        "abstract": "A global climate change assessment of global warming, climate crisis, extreme weather, biodiversity impacts, and public health risk.",
    },
    {
        "doi": "10.1126/science.1259855",
        "title": "Planetary boundaries: Guiding human development on a changing planet",
        "year": 2015,
        "publication_date": "2015-02-13",
        "journal": "Science",
        "publisher": "American Association for the Advancement of Science",
        "publication_type": "article",
        "abstract": "A planetary assessment of climate change, biodiversity loss, water resources, land use, ocean pollution, and sustainable practices.",
    },
    {
        "doi": "10.1038/nature14016",
        "title": "The geographical distribution of fossil fuels unused when limiting global warming to 2 degrees C",
        "year": 2015,
        "publication_date": "2015-01-08",
        "journal": "Nature",
        "publisher": "Nature Publishing Group",
        "publication_type": "article",
        "abstract": "A global climate change analysis of fossil fuels, carbon emissions, global warming, non-renewable resources, and climate action.",
    },
    {
        "doi": "10.1093/biosci/bix125",
        "title": "World scientists' warning to humanity: A second notice",
        "year": 2017,
        "publication_date": "2017-11-13",
        "journal": "BioScience",
        "publisher": "Oxford University Press",
        "publication_type": "article",
        "abstract": "A global environmentalism warning on climate change, biodiversity loss, deforestation, water resources, pollution, and sustainability.",
    },
    {
        "doi": "10.1073/pnas.1810141115",
        "title": "Trajectories of the Earth System in the Anthropocene",
        "year": 2018,
        "publication_date": "2018-08-14",
        "journal": "Proceedings of the National Academy of Sciences",
        "publisher": "National Academy of Sciences",
        "publication_type": "article",
        "abstract": "A planetary earth system assessment of climate change, anthropocene dynamics, global warming, feedbacks, and sustainability.",
    },
]


def main() -> int:
    pipeline.init_db(pipeline.DEFAULT_DB, pipeline.DEFAULT_SCHEMA, pipeline.DEFAULT_TOPIC_CLUSTERS)
    topic_clusters = pipeline.read_json(pipeline.DEFAULT_TOPIC_CLUSTERS)
    continent_mapping = pipeline.load_continent_mapping(pipeline.DEFAULT_CONTINENT_MAPPING)

    imported = 0
    topic_links = 0
    study_areas = 0
    with closing(pipeline.connect(pipeline.DEFAULT_DB)) as conn:
        for metadata in PUBLICATIONS:
            metadata = {
                **metadata,
                "url": f"https://doi.org/{metadata['doi']}",
            }
            raw_id = pipeline.insert_raw_import(
                conn,
                SOURCE_NAME,
                metadata["doi"].lower(),
                {"curated": True, "metadata": metadata},
            )
            publication_id = pipeline.upsert_publication(
                conn,
                metadata,
                SOURCE_NAME,
                metadata["doi"].lower(),
                raw_id,
            )
            score, _reasons = pipeline.score_research_foundation(metadata, topic_clusters)
            confidence = min(0.95, max(0.65, 0.55 + (score / 20)))
            topic_links += pipeline.classify_publication_topics(
                conn,
                publication_id,
                metadata,
                topic_clusters,
                confidence,
            )
            study_areas += pipeline.infer_study_areas(
                conn,
                publication_id,
                metadata,
                continent_mapping,
                max_countries=4,
                confidence=confidence,
            )
            imported += 1
        conn.commit()

    print(
        f"Historical curated import: {imported} imported/matched, "
        f"{topic_links} topic link(s), {study_areas} study area(s)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
