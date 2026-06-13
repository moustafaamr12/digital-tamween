import prisma from '../lib/prisma.js'

// ─── Pending Restock Store: id -> { outletId, items, otp, expiresAt, summary } ─
const pendingRestocks = new Map()
let restockSeq = 1
function genRestockId() { return `RST-${String(restockSeq++).padStart(4, '0')}` }
function genOtp() { return String(Math.floor(100000 + Math.random() * 900000)) }

export async function getStats(req, res) {
  const [totalOutlets, activeOutlets, totalUsers, totalPurchases, totalRevenue] = await Promise.all([
    prisma.outlet.count(),
    prisma.outlet.count({ where: { isActive: true } }),
    prisma.user.count(),
    prisma.purchase.count(),
    prisma.purchase.aggregate({ _sum: { totalAmount: true } }),
  ])
  res.json({ totalOutlets, activeOutlets, totalUsers, totalPurchases, totalRevenue: totalRevenue._sum.totalAmount ?? 0 })
}

export async function getAllOutlets(req, res) {
  const { search, productCategory, isActive } = req.query
  const where = {
    ...(isActive !== undefined && { isActive: isActive === 'true' }),
    ...(search && { OR: [
      { name: { contains: search, mode: 'insensitive' } },
      { address: { contains: search, mode: 'insensitive' } },
      { licenseNo: { contains: search, mode: 'insensitive' } },
    ]}),
  }

  const outlets = await prisma.outlet.findMany({
    where,
    include: {
      owner: { select: { name: true, email: true, phone: true } },
      products: {
        include: { product: true },
        ...(productCategory && { where: { product: { category: { contains: productCategory, mode: 'insensitive' } } } }),
      },
      _count: { select: { purchases: true, restocks: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  res.json(outlets.map((o) => ({
    id: o.id, name: o.name, address: o.address, latitude: o.latitude, longitude: o.longitude,
    licenseNo: o.licenseNo, phone: o.phone, isActive: o.isActive, owner: o.owner,
    totalPurchases: o._count.purchases, totalRestocks: o._count.restocks,
    products: o.products.map((op) => ({
      name: op.product.name, unit: op.product.unit, category: op.product.category,
      quantity: op.quantity, lowStock: op.quantity <= op.minThreshold,
    })),
  })))
}

export async function getOutletDetail(req, res) {
  const outlet = await prisma.outlet.findUnique({
    where: { id: req.params.id },
    include: {
      owner: { select: { name: true, email: true, phone: true } },
      products: { include: { product: true } },
    },
  })
  if (!outlet) return res.status(404).json({ error: 'Outlet not found' })
  res.json(outlet)
}

export async function getOutletSales(req, res) {
  const { page = 1, limit = 20 } = req.query
  const outletId = req.params.id

  const [total, sales] = await Promise.all([
    prisma.purchase.count({ where: { outletId } }),
    prisma.purchase.findMany({
      where: { outletId }, skip: (page - 1) * parseInt(limit), take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, nationalId: true, tamweenCardId: true } },
        items: { include: { product: true } },
        delivery: true,
      },
    }),
  ])
  res.json({ total, page: parseInt(page), data: sales })
}

export async function getOutletRestocks(req, res) {
  const { page = 1, limit = 20 } = req.query
  const outletId = req.params.id

  const [total, restocks] = await Promise.all([
    prisma.restockOperation.count({ where: { outletId } }),
    prisma.restockOperation.findMany({
      where: { outletId }, skip: (page - 1) * parseInt(limit), take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: { items: { include: { product: true } } },
    }),
  ])
  res.json({ total, page: parseInt(page), data: restocks })
}

export async function getAllUsers(req, res) {
  const { search, page = 1, limit = 20 } = req.query
  const where = search ? { OR: [
    { name: { contains: search, mode: 'insensitive' } },
    { nationalId: { contains: search } },
    { tamweenCardId: { contains: search } },
  ]} : {}

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where, skip: (page - 1) * parseInt(limit), take: parseInt(limit),
      orderBy: { name: 'asc' },
      select: { id: true, name: true, nationalId: true, tamweenCardId: true, phone: true, address: true, email: true, needScore: true, monthlyCredit: true, usedCredit: true, _count: { select: { purchases: true } } },
    }),
  ])

  res.json({ total, page: parseInt(page), data: users.map((u) => ({ ...u, remainingCredit: u.monthlyCredit - u.usedCredit, purchaseCount: u._count.purchases })) })
}

export async function getUserPurchases(req, res) {
  const { page = 1, limit = 20 } = req.query
  const userId = req.params.id

  const [total, purchases] = await Promise.all([
    prisma.purchase.count({ where: { userId } }),
    prisma.purchase.findMany({
      where: { userId }, skip: (page - 1) * parseInt(limit), take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: { outlet: { select: { id: true, name: true } }, items: { include: { product: true } }, delivery: true },
    }),
  ])
  res.json({ total, page: parseInt(page), data: purchases })
}

// ─── Restock Management ───────────────────────────────────────────────────────

export async function initiateRestock(req, res) {
  const { outletId, items, note } = req.body
  if (!outletId || !items?.length) return res.status(400).json({ error: 'outletId and items are required' })

  const outlet = await prisma.outlet.findUnique({ where: { id: outletId } })
  if (!outlet) return res.status(404).json({ error: 'المنفذ غير موجود' })

  // validate products and build summary
  const itemLines = []
  const validatedItems = []
  for (const item of items) {
    if (!item.quantity || item.quantity <= 0) continue
    const op = await prisma.outletProduct.findUnique({
      where: { outletId_productId: { outletId, productId: item.productId } },
      include: { product: true },
    })
    if (!op) return res.status(400).json({ error: 'منتج غير موجود في هذا المنفذ' })
    validatedItems.push({ productId: item.productId, quantity: item.quantity, name: op.product.name, unit: op.product.unit })
    itemLines.push(`• ${op.product.name}: ${item.quantity} ${op.product.unit}`)
  }
  if (!validatedItems.length) return res.status(400).json({ error: 'أدخل كميات صحيحة' })

  const otp = genOtp()
  const id = genRestockId()
  pendingRestocks.set(id, { outletId, items: validatedItems, note, otp, expiresAt: Date.now() + 10 * 60 * 1000, outletName: outlet.name })

  const content = [
    `📦 إشعار شحنة جديدة من الوزارة — ${outlet.name}`,
    '',
    'الأصناف:',
    ...itemLines,
    note ? `\nملاحظة: ${note}` : '',
    '',
    `🔐 رمز التأكيد: ${otp}`,
    'يُرجى تسليم الرمز لموظف الوزارة لإتمام استلام الشحنة',
  ].filter(Boolean).join('\n')

  await prisma.message.create({ data: { outletId, content, otp } })

  res.json({ id, message: 'تم إرسال رمز التأكيد للمنفذ', outletName: outlet.name, items: validatedItems })
}

export async function confirmRestock(req, res) {
  const { id } = req.params
  const { otp } = req.body

  const pending = pendingRestocks.get(id)
  if (!pending) return res.status(404).json({ error: 'طلب الشحن غير موجود أو انتهت صلاحيته' })
  if (Date.now() > pending.expiresAt) { pendingRestocks.delete(id); return res.status(400).json({ error: 'انتهت صلاحية رمز التأكيد' }) }
  if (pending.otp !== otp) return res.status(400).json({ error: 'رمز التأكيد غير صحيح' })

  const restock = await prisma.$transaction(async (tx) => {
    const r = await tx.restockOperation.create({
      data: {
        outletId: pending.outletId,
        note: pending.note,
        status: 'CONFIRMED',
        items: { create: pending.items.map(i => ({ productId: i.productId, quantity: i.quantity })) },
      },
    })
    for (const item of pending.items)
      await tx.outletProduct.update({
        where: { outletId_productId: { outletId: pending.outletId, productId: item.productId } },
        data: { quantity: { increment: item.quantity } },
      })
    return r
  })

  pendingRestocks.delete(id)
  res.json({ message: 'تمت عملية الشحن بنجاح', restockId: restock.id })
}

export async function getPendingRestocks(req, res) {
  const result = []
  for (const [id, r] of pendingRestocks.entries()) {
    if (Date.now() > r.expiresAt) { pendingRestocks.delete(id); continue }
    result.push({ id, outletName: r.outletName, outletId: r.outletId, items: r.items, note: r.note, expiresAt: r.expiresAt })
  }
  res.json(result)
}
