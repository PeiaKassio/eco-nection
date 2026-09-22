const assert = require('node:assert/strict');
const analysis = require('../assets/js/data-analysis.js');

const filters = {
  continent: '',
  country: '',
  topics: [],
  fromYear: null,
  toYear: null
};

const records = [
  {
    id: 'a1',
    year: 2020,
    country: 'Germany',
    continent: 'Europe',
    clusters: ['Climate Change']
  },
  {
    id: 'a2',
    year: 2020,
    country: 'Germany',
    continent: 'Europe',
    clusters: ['Climate Change', 'Biodiversity']
  },
  {
    id: 'a3',
    year: 2021,
    country: 'Germany',
    continent: 'Europe',
    clusters: ['Waste']
  },
  {
    id: 'a4',
    year: 2021,
    country: 'France',
    continent: 'Europe',
    clusters: ['Climate Change']
  }
];

const scienceStudyAreas = [
  {
    id: 'p1',
    year: 2020,
    country: 'Germany',
    continent: 'Europe',
    clusters: ['Climate Change']
  },
  {
    id: 'p1',
    year: 2020,
    country: 'Germany',
    continent: 'Europe',
    clusters: ['Climate Change']
  },
  {
    id: 'p2',
    year: 2020,
    country: 'Germany',
    continent: 'Europe',
    clusters: ['Climate Change', 'Biodiversity']
  },
  {
    id: 'p3',
    year: 2021,
    country: 'Germany',
    continent: 'Europe',
    clusters: ['Biodiversity']
  }
];

const climateShare = analysis.calculateTopicShare(records, filters, 'Climate Change', 'share');
assert.equal(climateShare.count, 3, 'unique records in a topic cluster count once');
assert.equal(climateShare.denominator, 4);
assert.equal(climateShare.value, 75);

const biodiversityShare = analysis.calculateTopicShare(records, filters, 'Biodiversity', 'share');
assert.equal(biodiversityShare.count, 1, 'multi-cluster records contribute once to each cluster');
assert.equal(biodiversityShare.denominator, 4, 'multi-cluster records still count once in the denominator');

const dedupedScienceShare = analysis.calculateTopicShare(scienceStudyAreas, filters, 'Climate Change', 'share');
assert.equal(dedupedScienceShare.count, 2, 'duplicate study-area rows for one publication count once');
assert.equal(dedupedScienceShare.denominator, 3);

const yearly = analysis.calculateYearlyTopicShares(records, filters, 'Climate Change', 'share');
assert.deepEqual(
  yearly.map(point => [point.year, point.count, point.denominator, point.value]),
  [
    [2020, 2, 2, 100],
    [2021, 1, 2, 50]
  ],
  'yearly share recalculates the denominator for each year'
);

const metrics = analysis.calculateTopicMetrics(records, scienceStudyAreas, filters, ['Climate Change'], 'share', {});
assert.equal(Math.round(metrics[0].difference * 100) / 100, 8.33, 'difference is Art share minus Science share in percentage points');

const center = analysis.calculateAttentionCenter([
  { year: 2018, share: 10, count: 1, denominator: 10 },
  { year: 2019, share: 10, count: 1, denominator: 10 },
  { year: 2020, share: 80, count: 8, denominator: 10 }
]);
assert.equal(center, 2020, 'attention center uses weighted median year');

const shift = analysis.calculateTemporalShift(
  [
    { year: 2020, share: 20, count: 2, denominator: 10 },
    { year: 2021, share: 40, count: 3, denominator: 10 }
  ],
  [
    { year: 2018, share: 20, count: 2, denominator: 10 },
    { year: 2019, share: 40, count: 3, denominator: 10 }
  ]
);
assert.equal(shift.supported, true);
assert.equal(shift.shift, 2, 'temporal shift is Art center minus Science center');

const unsupportedShift = analysis.calculateTemporalShift(
  [{ year: 2020, share: 20, count: 1, denominator: 10 }],
  [{ year: 2019, share: 20, count: 1, denominator: 10 }]
);
assert.equal(unsupportedShift.supported, false, 'sparse data does not produce a forced shift');

console.log('data-analysis calculation tests passed');
