import 'dotenv/config'
import { PrismaClient } from '../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

// ─── Weights (الأوزان المتفق عليها) ───────────────────────────────────────────
const W = { outlet: 0.30, income: 0.25, crop: 0.23, store: 0.16, distance: 0.06 }

// ─── Raw Data for Egyptian Governorates ───────────────────────────────────────
const rawData = [
  { name: 'القاهرة',     governorate: 'القاهرة',     type: 'urban',  lat: 30.0444, lng: 31.2357, pop: 10000000, income: 4500, povertyRate: 8,  storeCount: 8000, outlets: 5000, cropsTons: 500,  dist: 0 },
  { name: 'الجيزة',      governorate: 'الجيزة',      type: 'urban',  lat: 30.0131, lng: 31.2089, pop: 8500000,  income: 3800, povertyRate: 12, storeCount: 6000, outlets: 3800, cropsTons: 2000, dist: 20 },
  { name: 'الإسكندرية',  governorate: 'الإسكندرية',  type: 'urban',  lat: 31.2001, lng: 29.9187, pop: 5200000,  income: 4000, povertyRate: 10, storeCount: 5000, outlets: 2500, cropsTons: 800,  dist: 220 },
  { name: 'الدقهلية',    governorate: 'الدقهلية',    type: 'rural',  lat: 31.1656, lng: 31.4913, pop: 5900000,  income: 2500, povertyRate: 25, storeCount: 4000, outlets: 1200, cropsTons: 8000, dist: 120 },
  { name: 'الشرقية',     governorate: 'الشرقية',     type: 'rural',  lat: 30.7426, lng: 31.7238, pop: 7000000,  income: 2400, povertyRate: 28, storeCount: 3000, outlets: 1100, cropsTons: 9000, dist: 80 },
  { name: 'الغربية',     governorate: 'الغربية',     type: 'rural',  lat: 30.8501, lng: 31.0124, pop: 4800000,  income: 2600, povertyRate: 22, storeCount: 3500, outlets: 900,  cropsTons: 7500, dist: 90 },
  { name: 'المنيا',      governorate: 'المنيا',      type: 'rural',  lat: 28.0871, lng: 30.7618, pop: 5400000,  income: 1800, povertyRate: 40, storeCount: 1500, outlets: 400,  cropsTons: 5000, dist: 250 },
  { name: 'بني سويف',    governorate: 'بني سويف',    type: 'rural',  lat: 29.0661, lng: 31.0994, pop: 3300000,  income: 1800, povertyRate: 35, storeCount: 1000, outlets: 320,  cropsTons: 4500, dist: 130 },
  { name: 'الفيوم',      governorate: 'الفيوم',      type: 'rural',  lat: 29.3084, lng: 30.8428, pop: 3500000,  income: 1700, povertyRate: 38, storeCount: 1100, outlets: 350,  cropsTons: 4000, dist: 100 },
  { name: 'أسيوط',       governorate: 'أسيوط',       type: 'rural',  lat: 27.1809, lng: 31.1837, pop: 4400000,  income: 1700, povertyRate: 42, storeCount: 1300, outlets: 380,  cropsTons: 4500, dist: 380 },
  { name: 'سوهاج',       governorate: 'سوهاج',       type: 'rural',  lat: 26.5590, lng: 31.6948, pop: 4900000,  income: 1600, povertyRate: 45, storeCount: 1200, outlets: 280,  cropsTons: 4000, dist: 470 },
  { name: 'قنا',         governorate: 'قنا',         type: 'rural',  lat: 26.1551, lng: 32.7160, pop: 3100000,  income: 1500, povertyRate: 48, storeCount: 900,  outlets: 200,  cropsTons: 3500, dist: 600 },
  { name: 'أسوان',       governorate: 'أسوان',       type: 'rural',  lat: 24.0889, lng: 32.8998, pop: 1400000,  income: 1600, povertyRate: 38, storeCount: 700,  outlets: 150,  cropsTons: 2000, dist: 900 },
  { name: 'الأقصر',      governorate: 'الأقصر',      type: 'rural',  lat: 25.6872, lng: 32.6396, pop: 1200000,  income: 1600, povertyRate: 40, storeCount: 600,  outlets: 120,  cropsTons: 1500, dist: 650 },
  { name: 'مطروح',       governorate: 'مطروح',       type: 'remote', lat: 31.3543, lng: 27.2373, pop: 400000,   income: 1900, povertyRate: 32, storeCount: 200,  outlets: 40,   cropsTons: 500,  dist: 350 },
]

function normalize(val, min, max, invert = false) {
  if (max === min) return 0
  const n = (val - min) / (max - min) * 100
  return Math.round((invert ? 100 - n : n) * 100) / 100
}

function getPriorityTier(score) {
  if (score >= 70) return 'CRITICAL'
  if (score >= 50) return 'HIGH'
  if (score >= 30) return 'MEDIUM'
  return 'LOW'
}

function computeScores(data) {
  const derived = data.map(r => ({
    ...r,
    outletPer1000: r.outlets / r.pop * 1000,
    cropPerCapita: r.cropsTons / r.pop,
    storePer1000:  r.storeCount / r.pop * 1000,
  }))

  const vals = (key) => derived.map(r => r[key])
  const mn = (key) => Math.min(...vals(key))
  const mx = (key) => Math.max(...vals(key))

  const outletMin = mn('outletPer1000'), outletMax = mx('outletPer1000')
  const incomeMin = mn('income'),        incomeMax = mx('income')
  const cropMin   = mn('cropPerCapita'), cropMax   = mx('cropPerCapita')
  const storeMin  = mn('storePer1000'),  storeMax  = mx('storePer1000')
  const distMin   = mn('dist'),          distMax   = mx('dist')

  return derived.map(r => {
    const outletScore   = normalize(r.outletPer1000, outletMin, outletMax, true)
    const incomeScore   = normalize(r.income,        incomeMin, incomeMax, true)
    const cropScore     = normalize(r.cropPerCapita, cropMin,   cropMax,   true)
    const storeScore    = normalize(r.storePer1000,  storeMin,  storeMax,  true)
    const distanceScore = normalize(r.dist,          distMin,   distMax,   false)

    const totalScore = Math.round((
      outletScore   * W.outlet +
      incomeScore   * W.income +
      cropScore     * W.crop +
      storeScore    * W.store +
      distanceScore * W.distance
    ) * 100) / 100

    return { ...r, outletScore, incomeScore, cropScore, storeScore, distanceScore, totalScore, priorityTier: getPriorityTier(totalScore) }
  }).sort((a, b) => b.totalScore - a.totalScore)
}

const convoys = [
  { name: 'قافلة أمان 1',        entity: 'القوات المسلحة',      capacityTons: 50,  status: 'AVAILABLE' },
  { name: 'قافلة أمان 2',        entity: 'القوات المسلحة',      capacityTons: 50,  status: 'AVAILABLE' },
  { name: 'قافلة تحيا مصر 1',   entity: 'صندوق تحيا مصر',      capacityTons: 30,  status: 'DISPATCHED' },
  { name: 'قافلة تحيا مصر 2',   entity: 'صندوق تحيا مصر',      capacityTons: 30,  status: 'AVAILABLE' },
  { name: 'قافلة وزارة التموين', entity: 'وزارة التموين',       capacityTons: 40,  status: 'AVAILABLE' },
]

async function main() {
  console.log('🌱 Seeding food security database...')

  await prisma.alert.deleteMany()
  await prisma.convoyMission.deleteMany()
  await prisma.convoy.deleteMany()
  await prisma.deprivationScore.deleteMany()
  await prisma.tamweenSync.deleteMany()
  await prisma.agriculturalData.deleteMany()
  await prisma.populationStats.deleteMany()
  await prisma.region.deleteMany()
  await prisma.pipelineRun.deleteMany()

  const scored = computeScores(rawData)

  for (const r of scored) {
    const region = await prisma.region.create({
      data: { name: r.name, governorate: r.governorate, type: r.type, latitude: r.lat, longitude: r.lng, population: r.pop },
    })

    await prisma.populationStats.create({
      data: { regionId: region.id, avgMonthlyIncome: r.income, povertyRate: r.povertyRate, foodStoreCount: r.storeCount, year: 2024 },
    })

    await prisma.agriculturalData.create({
      data: { regionId: region.id, cropName: 'محاصيل متنوعة', productionTons: r.cropsTons, consumptionEst: r.cropsTons * 1.2, localPrice: 5.5, season: 'شتوي/صيفي' },
    })

    await prisma.tamweenSync.create({
      data: { regionId: region.id, outletCount: r.outlets, avgInventoryLevel: 65.0, monthlySalesVolume: r.outlets * 120 },
    })

    await prisma.deprivationScore.create({
      data: {
        regionId:     region.id,
        outletScore:  r.outletScore,
        incomeScore:  r.incomeScore,
        cropScore:    r.cropScore,
        storeScore:   r.storeScore,
        distanceScore: r.distanceScore,
        totalScore:   r.totalScore,
        priorityTier: r.priorityTier,
      },
    })
  }

  const createdConvoys = []
  for (const c of convoys) {
    const convoy = await prisma.convoy.create({ data: c })
    createdConvoys.push(convoy)
  }

  const criticalRegions = await prisma.region.findMany({
    include: { deprivationScores: { orderBy: { calculatedAt: 'desc' }, take: 1 } },
    where: { deprivationScores: { some: { priorityTier: 'CRITICAL' } } },
  })

  for (let i = 0; i < Math.min(criticalRegions.length, 2); i++) {
    await prisma.alert.create({
      data: {
        regionId: criticalRegions[i].id,
        convoyId: createdConvoys[0].id,
        alertType: 'CRITICAL_REGION',
        message: `منطقة ${criticalRegions[i].name} تحتاج دعماً غذائياً عاجلاً`,
        status: 'PENDING',
      },
    })
  }

  await prisma.pipelineRun.create({
    data: { dagName: 'food_security_daily_scoring', status: 'SUCCESS', regionsProcessed: rawData.length, completedAt: new Date() },
  })

  console.log(`✅ Seeded ${scored.length} regions`)
  console.log('📊 Priority breakdown:')
  ;['CRITICAL','HIGH','MEDIUM','LOW'].forEach(tier => {
    console.log(`   ${tier}: ${scored.filter(r => r.priorityTier === tier).length} regions`)
  })
  console.log('Top 3 most deprived regions:')
  scored.slice(0, 3).forEach((r, i) => console.log(`   ${i+1}. ${r.name} - Score: ${r.totalScore} (${r.priorityTier})`))
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
