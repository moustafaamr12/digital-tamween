import prisma from '../lib/prisma.js'

export async function getProfile(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true, nationalId: true, tamweenCardId: true, phone: true, address: true, email: true, monthlyCredit: true, usedCredit: true },
  })
  if (!user) return res.status(404).json({ error: 'User not found' })
  res.json({ ...user, remainingCredit: user.monthlyCredit - user.usedCredit })
}

export async function getOutlets(req, res) {
  const { lat, lng, search } = req.query

  const outlets = await prisma.outlet.findMany({
    where: {
      isActive: true,
      ...(search && { OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ]}),
    },
    include: {
      products: { include: { product: true }, where: { quantity: { gt: 0 } } },
    },
  })

  let result = outlets.map((o) => ({
    id: o.id, name: o.name, address: o.address,
    latitude: o.latitude, longitude: o.longitude, phone: o.phone,
    products: o.products.map((op) => ({
      id: op.product.id, name: op.product.name, unit: op.product.unit,
      quantity: op.quantity, pricePerUnit: op.pricePerUnit,
    })),
    distance: null,
  }))

  if (lat && lng) {
    const uLat = parseFloat(lat), uLng = parseFloat(lng)
    result = result
      .map((o) => ({ ...o, distance: haversine(uLat, uLng, o.latitude, o.longitude) }))
      .sort((a, b) => a.distance - b.distance)
  }

  res.json(result)
}

export async function getOutletById(req, res) {
  const outlet = await prisma.outlet.findUnique({
    where: { id: req.params.id },
    include: { products: { include: { product: true } } },
  })
  if (!outlet || !outlet.isActive) return res.status(404).json({ error: 'Outlet not found' })

  res.json({
    id: outlet.id, name: outlet.name, address: outlet.address,
    latitude: outlet.latitude, longitude: outlet.longitude, phone: outlet.phone,
    products: outlet.products.map((op) => ({
      id: op.product.id, name: op.product.name, unit: op.product.unit,
      category: op.product.category, quantity: op.quantity,
      pricePerUnit: op.pricePerUnit, available: op.quantity > 0,
    })),
  })
}

export async function getPurchaseHistory(req, res) {
  const purchases = await prisma.purchase.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      outlet: { select: { id: true, name: true, address: true } },
      items: { include: { product: true } },
      delivery: true,
    },
  })
  res.json(purchases.map((p) => ({
    id: p.id, type: p.type, status: p.status, totalAmount: p.totalAmount, createdAt: p.createdAt,
    paymentMethod: p.paymentMethod, extraPaymentMethod: p.extraPaymentMethod, extraAmount: p.extraAmount,
    outlet: p.outlet,
    items: p.items.map((i) => ({ product: i.product.name, unit: i.product.unit, quantity: i.quantity, unitPrice: i.unitPrice })),
    delivery: p.delivery ? { address: p.delivery.address, status: p.delivery.status, deliveryFee: p.delivery.deliveryFee } : null,
  })))
}

export async function orderDelivery(req, res) {
  const { outletId, address, latitude, longitude, items } = req.body
  if (!outletId || !address || !items?.length) {
    return res.status(400).json({ error: 'outletId, address, and items are required' })
  }

  const userId = req.user.id
  const deliveryFee = parseFloat(process.env.DELIVERY_FEE || '5')

  const outlet = await prisma.outlet.findUnique({ where: { id: outletId } })
  if (!outlet || !outlet.isActive) return res.status(404).json({ error: 'Outlet not found' })

  let totalAmount = deliveryFee
  const validatedItems = []

  for (const item of items) {
    const op = await prisma.outletProduct.findUnique({
      where: { outletId_productId: { outletId, productId: item.productId } },
      include: { product: true },
    })
    if (!op) return res.status(400).json({ error: `Product ${item.productId} not in this outlet` })
    if (op.quantity < item.quantity) return res.status(400).json({ error: `Not enough stock for ${op.product.name}` })
    validatedItems.push({ op, quantity: item.quantity })
    totalAmount += op.pricePerUnit * item.quantity
  }

  const purchase = await prisma.$transaction(async (tx) => {
    const p = await tx.purchase.create({
      data: {
        userId, outletId, type: 'DELIVERY', totalAmount, status: 'PENDING',
        items: { create: validatedItems.map(({ op, quantity }) => ({ productId: op.productId, quantity, unitPrice: op.pricePerUnit })) },
        delivery: { create: { userId, address, latitude, longitude, deliveryFee } },
      },
      include: { items: { include: { product: true } }, delivery: true },
    })
    for (const { op, quantity } of validatedItems) {
      await tx.outletProduct.update({ where: { outletId_productId: { outletId, productId: op.productId } }, data: { quantity: { decrement: quantity } } })
    }
    return p
  })

  const io = req.app.get('io')
  if (io) {
    io.to(`outlet:${outletId}`).emit('new-order', { purchaseId: purchase.id, type: 'DELIVERY', totalAmount })
    for (const { op } of validatedItems) {
      const updated = await prisma.outletProduct.findUnique({ where: { outletId_productId: { outletId, productId: op.productId } }, include: { product: true } })
      if (updated && updated.quantity <= updated.minThreshold) {
        io.to(`outlet:${outletId}`).emit('low-stock', { product: updated.product.name, remaining: updated.quantity })
      }
    }
  }

  res.status(201).json({ message: 'Order placed successfully', purchase })
}

export async function getDeliveryOrders(req, res) {
  const orders = await prisma.deliveryOrder.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      purchase: {
        include: {
          items: { include: { product: true } },
          outlet: { select: { name: true } },
        },
      },
    },
  })
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { monthlyCredit: true, usedCredit: true } })
  const remaining = user.monthlyCredit - user.usedCredit
  res.json(orders.map((o) => ({
    id: o.id, status: o.status, address: o.address,
    createdAt: o.createdAt, updatedAt: o.updatedAt,
    deliveryFee: o.deliveryFee,
    extraPaymentMethod: o.extraPaymentMethod,
    outletName: o.purchase.outlet.name,
    itemCount: o.purchase.items.length,
    totalAmount: o.purchase.totalAmount,
    items: o.purchase.items.map((i) => ({ product: i.product.name, unit: i.product.unit, quantity: i.quantity, unitPrice: i.unitPrice })),
    extraPayment: Math.max(0, o.purchase.totalAmount - remaining),
  })))
}

export async function getMessages(req, res) {
  const messages = await prisma.message.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  await prisma.message.updateMany({ where: { userId: req.user.id, isRead: false }, data: { isRead: true } })
  res.json(messages)
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371, dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
function toRad(deg) { return (deg * Math.PI) / 180 }
