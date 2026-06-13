import prisma from '../lib/prisma.js'

const deliveryOtpStore = new Map()

export async function getOutletProfile(req, res) {
  const outlet = await prisma.outlet.findUnique({
    where: { id: req.user.outletId },
    include: { owner: { select: { name: true, email: true, phone: true } } },
  })
  if (!outlet) return res.status(404).json({ error: 'Outlet not found' })
  res.json(outlet)
}

export async function getInventory(req, res) {
  const { outletId } = req.user
  const products = await prisma.outletProduct.findMany({
    where: { outletId },
    include: { product: true },
    orderBy: { product: { name: 'asc' } },
  })
  const result = products.map((op) => ({
    id: op.id, productId: op.product.id, name: op.product.name,
    unit: op.product.unit, category: op.product.category,
    quantity: op.quantity, minThreshold: op.minThreshold,
    pricePerUnit: op.pricePerUnit, lowStock: op.quantity <= op.minThreshold,
  }))
  res.json({ products: result, alerts: result.filter((p) => p.lowStock) })
}

export async function getSalesHistory(req, res) {
  const { outletId } = req.user
  const { page = 1, limit = 20, type } = req.query
  const where = { outletId, ...(type && { type }) }

  const [total, sales] = await Promise.all([
    prisma.purchase.count({ where }),
    prisma.purchase.findMany({
      where, skip: (page - 1) * parseInt(limit), take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, tamweenCardId: true } },
        items: { include: { product: true } },
        delivery: { select: { address: true, status: true } },
      },
    }),
  ])

  res.json({
    total, page: parseInt(page),
    data: sales.map((s) => ({
      id: s.id, type: s.type, status: s.status, totalAmount: s.totalAmount, createdAt: s.createdAt,
      paymentMethod: s.paymentMethod, extraPaymentMethod: s.extraPaymentMethod, extraAmount: s.extraAmount,
      user: s.user,
      items: s.items.map((i) => ({ product: i.product.name, unit: i.product.unit, quantity: i.quantity, unitPrice: i.unitPrice })),
      delivery: s.delivery,
    })),
  })
}

export async function getRestockHistory(req, res) {
  const { outletId } = req.user
  const { page = 1, limit = 20 } = req.query

  const [total, restocks] = await Promise.all([
    prisma.restockOperation.count({ where: { outletId } }),
    prisma.restockOperation.findMany({
      where: { outletId }, skip: (page - 1) * parseInt(limit), take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: { items: { include: { product: true } } },
    }),
  ])

  res.json({
    total, page: parseInt(page),
    data: restocks.map((r) => ({
      id: r.id, note: r.note, createdAt: r.createdAt,
      items: r.items.map((i) => ({ product: i.product.name, unit: i.product.unit, quantity: i.quantity, weightKg: i.weightKg })),
    })),
  })
}

export async function getDeliveryOrders(req, res) {
  const { outletId } = req.user
  const orders = await prisma.deliveryOrder.findMany({
    where: { purchase: { outletId } },
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, name: true, tamweenCardId: true, monthlyCredit: true, usedCredit: true } },
      purchase: { include: { items: { include: { product: true } } } },
    },
  })
  res.json(orders.map((o) => {
    const remaining = o.user.monthlyCredit - o.user.usedCredit
    return {
      id: o.id, status: o.status, address: o.address,
      createdAt: o.createdAt, updatedAt: o.updatedAt,
      deliveryFee: o.deliveryFee,
      extraPaymentMethod: o.extraPaymentMethod,
      user: { name: o.user.name, tamweenCardId: o.user.tamweenCardId },
      itemCount: o.purchase.items.length,
      totalAmount: o.purchase.totalAmount,
      items: o.purchase.items.map((i) => ({ product: i.product.name, unit: i.product.unit, quantity: i.quantity, unitPrice: i.unitPrice })),
      remainingCredit: remaining,
      extraPayment: Math.max(0, o.purchase.totalAmount - remaining),
    }
  }))
}

export async function updateDeliveryStatus(req, res) {
  const { id } = req.params
  const { status } = req.body
  const { outletId } = req.user

  const order = await prisma.deliveryOrder.findFirst({
    where: { id, purchase: { outletId } },
    include: { user: true },
  })
  if (!order) return res.status(404).json({ error: 'Order not found' })

  await prisma.deliveryOrder.update({ where: { id }, data: { status } })

  if (status === 'OUT_FOR_DELIVERY') {
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    deliveryOtpStore.set(id, otp)
    await prisma.message.create({
      data: {
        userId: order.userId,
        content: `طلب التوصيل الخاص بك في الطريق إليك! رمز تأكيد الاستلام: ${otp}`,
        otp,
      },
    })
  }

  res.json({ message: 'Status updated', status })
}

export async function confirmDelivery(req, res) {
  const { id } = req.params
  const { otp, paymentMethod } = req.body
  const { outletId } = req.user

  const storedOtp = deliveryOtpStore.get(id)
  if (!storedOtp || storedOtp !== String(otp).trim()) {
    return res.status(400).json({ error: 'رمز OTP غير صحيح' })
  }

  const order = await prisma.deliveryOrder.findFirst({
    where: { id, purchase: { outletId } },
    include: { user: true, purchase: true },
  })
  if (!order) return res.status(404).json({ error: 'Order not found' })

  const remaining = order.user.monthlyCredit - order.user.usedCredit
  const creditToDeduct = Math.min(order.purchase.totalAmount, remaining)
  const hasExtra = order.purchase.totalAmount > remaining
  const method = hasExtra ? (paymentMethod || 'CASH') : null

  await prisma.$transaction(async (tx) => {
    await tx.deliveryOrder.update({ where: { id }, data: { status: 'DELIVERED', extraPaymentMethod: method } })
    await tx.purchase.update({ where: { id: order.purchaseId }, data: { status: 'CONFIRMED' } })
    if (creditToDeduct > 0) {
      await tx.user.update({ where: { id: order.userId }, data: { usedCredit: { increment: creditToDeduct } } })
    }
  })

  deliveryOtpStore.delete(id)
  res.json({ message: 'تم تأكيد الاستلام وخصم الرصيد بنجاح' })
}

export async function addRestock(req, res) {
  const { outletId } = req.user
  const { note, items } = req.body
  if (!items?.length) return res.status(400).json({ error: 'items are required' })

  const restock = await prisma.$transaction(async (tx) => {
    const op = await tx.restockOperation.create({
      data: {
        outletId, note,
        items: { create: items.map((i) => ({ productId: i.productId, quantity: i.quantity, weightKg: i.weightKg ?? null })) },
      },
      include: { items: { include: { product: true } } },
    })
    for (const item of items) {
      await tx.outletProduct.upsert({
        where: { outletId_productId: { outletId, productId: item.productId } },
        update: { quantity: { increment: item.quantity } },
        create: { outletId, productId: item.productId, quantity: item.quantity, pricePerUnit: 0 },
      })
    }
    return op
  })

  const io = req.app.get('io')
  if (io) io.to('admin').emit('restock-added', { outletId, restockId: restock.id })

  res.status(201).json(restock)
}

// ─── Outlet Messages ──────────────────────────────────────────────────────────

export async function getOutletMessages(req, res) {
  const { outletId } = req.user
  const messages = await prisma.message.findMany({
    where: { outletId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  res.json(messages)
}

export async function markMessageRead(req, res) {
  const { id } = req.params
  await prisma.message.update({ where: { id }, data: { isRead: true } })
  res.json({ ok: true })
}

