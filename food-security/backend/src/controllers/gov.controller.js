import prisma from '../lib/prisma.js'

export async function getRegions(req, res) {
  const regions = await prisma.region.findMany({
    include: {
      deprivationScores: { orderBy: { calculatedAt: 'desc' }, take: 1 },
      tamweenSync:       { orderBy: { syncedAt: 'desc' },     take: 1 },
      populationStats:   { orderBy: { updatedAt: 'desc' },    take: 1 },
    },
  })

  const result = regions
    .map((r) => {
      const score = r.deprivationScores[0]
      const sync  = r.tamweenSync[0]
      const stats = r.populationStats[0]
      return {
        id:           r.id,
        name:         r.name,
        governorate:  r.governorate,
        type:         r.type,
        latitude:     r.latitude,
        longitude:    r.longitude,
        population:   r.population,
        outletCount:  sync?.outletCount ?? 0,
        avgIncome:    stats?.avgMonthlyIncome ?? 0,
        povertyRate:  stats?.povertyRate ?? 0,
        score: score ? {
          outletScore:   score.outletScore,
          incomeScore:   score.incomeScore,
          cropScore:     score.cropScore,
          storeScore:    score.storeScore,
          distanceScore: score.distanceScore,
          totalScore:    score.totalScore,
          priorityTier:  score.priorityTier,
          calculatedAt:  score.calculatedAt,
        } : null,
      }
    })
    .sort((a, b) => (b.score?.totalScore ?? 0) - (a.score?.totalScore ?? 0))

  res.json(result)
}

export async function getRegionById(req, res) {
  const region = await prisma.region.findUnique({
    where: { id: req.params.id },
    include: {
      deprivationScores: { orderBy: { calculatedAt: 'desc' }, take: 5 },
      tamweenSync:       { orderBy: { syncedAt: 'desc' },     take: 1 },
      populationStats:   { orderBy: { updatedAt: 'desc' },    take: 1 },
      agriculturalData:  true,
      convoyMissions:    { include: { convoy: true }, orderBy: { dispatchedAt: 'desc' }, take: 5 },
      alerts:            { orderBy: { sentAt: 'desc' }, take: 5 },
    },
  })
  if (!region) return res.status(404).json({ error: 'Region not found' })
  res.json(region)
}

export async function getConvoys(req, res) {
  const convoys = await prisma.convoy.findMany({
    include: {
      missions: { include: { region: { select: { name: true, governorate: true } } }, orderBy: { dispatchedAt: 'desc' }, take: 3 },
    },
    orderBy: { updatedAt: 'desc' },
  })
  res.json(convoys)
}

export async function getStats(req, res) {
  const [totalRegions, criticalCount, highCount, lastPipeline, alertsCount] = await Promise.all([
    prisma.region.count(),
    prisma.deprivationScore.count({ where: { priorityTier: 'CRITICAL' } }),
    prisma.deprivationScore.count({ where: { priorityTier: 'HIGH' } }),
    prisma.pipelineRun.findFirst({ orderBy: { startedAt: 'desc' } }),
    prisma.alert.count({ where: { status: 'PENDING' } }),
  ])
  res.json({ totalRegions, criticalCount, highCount, alertsCount, lastPipeline })
}
