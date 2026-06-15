import prisma from '../lib/prisma.js'
import { getAndClearQrAuth, qrAuthStore } from './qr.controller.js'

// In-memory OTP store: nationalId -> { otp, expiresAt }
const otpStore = new Map()

// In-memory confirmation OTP store (purchase summary OTP)
export const confirmStore = new Map()

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

// ─── Existing: lookup by tamween card ID ─────────────────────────────────────

export async function lookupUser(req, res) {
  const user = await prisma.user.findUnique({
    where: { tamweenCardId: req.params.tamweenCardId },
    select: { id: true, name: true, tamweenCardId: true, monthlyCredit: true, usedCredit: true },
  })
  if (!user) return res.status(404).json({ error: 'Tamween card not found' })
  res.json({ ...user, remainingCredit: user.monthlyCredit - user.usedCredit })
}

// ─── Method 1: OTP ───────────────────────────────────────────────────────────

export async function requestOtp(req, res) {
  const { nationalId } = req.body
  if (!nationalId) return res.status(400).json({ error: 'nationalId is required' })

  const user = await prisma.user.findUnique({
    where: { nationalId },
    select: { id: true, name: true, tamweenCardId: true, monthlyCredit: true, usedCredit: true },
  })
  if (!user) return res.status(404).json({ error: 'لا يوجد مواطن بهذا الرقم القومي' })

  const otp = generateOtp()
  otpStore.set(nationalId, { otp, expiresAt: Date.now() + 5 * 60 * 1000 })

  await prisma.message.create({
    data: {
      userId: user.id,
      content: `رمز التحقق الخاص بك للشراء من منفذ التموين هو: ${otp} — صالح لمدة 5 دقائق`,
      otp,
    },
  })

  res.json({ message: 'OTP sent', userName: user.name, otp })
}

export async function verifyOtp(req, res) {
  const { nationalId, otp } = req.body
  if (!nationalId || !otp) return res.status(400).json({ error: 'nationalId and otp are required' })

  const entry = otpStore.get(nationalId)
  if (!entry) return res.status(400).json({ error: 'لم يتم طلب OTP لهذا الرقم القومي' })
  if (Date.now() > entry.expiresAt) { otpStore.delete(nationalId); return res.status(400).json({ error: 'انتهت صلاحية OTP' }) }
  if (entry.otp !== otp) return res.status(400).json({ error: 'رمز OTP غير صحيح' })

  const user = await prisma.user.findUnique({
    where: { nationalId },
    select: { id: true, name: true, tamweenCardId: true, monthlyCredit: true, usedCredit: true },
  })
  res.json({ ...user, remainingCredit: user.monthlyCredit - user.usedCredit })
}

export async function sendConfirmOtp(req, res) {
  const { outletId } = req.user
  const { nationalId, items, paymentMethod = 'BALANCE', shortfallMethod = null } = req.body
  if (!nationalId || !items?.length) return res.status(400).json({ error: 'nationalId and items are required' })

  const user = await prisma.user.findUnique({
    where: { nationalId },
    select: { id: true, name: true, monthlyCredit: true, usedCredit: true },
  })
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' })

  let totalAmount = 0
  const itemLines = []
  for (const item of items) {
    const op = await prisma.outletProduct.findUnique({
      where: { outletId_productId: { outletId, productId: item.productId } },
      include: { product: true },
    })
    if (!op) return res.status(400).json({ error: 'منتج غير موجود' })
    const lineTotal = op.pricePerUnit * item.quantity
    totalAmount += lineTotal
    itemLines.push(`• ${op.product.name}: ${item.quantity} ${op.product.unit} × ${op.pricePerUnit} جنيه = ${lineTotal.toFixed(2)} جنيه`)
  }

  const remaining = user.monthlyCredit - user.usedCredit
  const shortfall = paymentMethod === 'BALANCE' ? Math.max(0, totalAmount - remaining) : 0
  const balanceUsed = paymentMethod === 'BALANCE' ? Math.min(remaining, totalAmount) : 0

  let paymentLine
  if (paymentMethod === 'BALANCE' && shortfall === 0) {
    paymentLine = `من رصيد التموين (المتبقي بعد العملية: ${(remaining - totalAmount).toFixed(2)} جنيه)`
  } else if (paymentMethod === 'BALANCE' && shortfall > 0) {
    const sfLabel = shortfallMethod === 'CARD' ? 'بطاقة بنكية' : 'كاش'
    paymentLine = `${balanceUsed.toFixed(2)} جنيه من الرصيد + ${shortfall.toFixed(2)} جنيه ${sfLabel}`
  } else if (paymentMethod === 'CARD') {
    paymentLine = 'بطاقة بنكية'
  } else {
    paymentLine = 'كاش'
  }

  const otp = generateOtp()
  confirmStore.set(nationalId, { otp, expiresAt: Date.now() + 5 * 60 * 1000 })

  const content = [
    '📋 تأكيد عملية الشراء من منفذ التموين',
    '',
    'المنتجات:',
    ...itemLines,
    '',
    `الإجمالي: ${totalAmount.toFixed(2)} جنيه`,
    `طريقة الدفع: ${paymentLine}`,
    '',
    `🔐 رمز التأكيد: ${otp}`,
    'صالح لمدة 5 دقائق — لا تشاركه إلا مع موظف المنفذ',
  ].join('\n')

  await prisma.message.create({ data: { userId: user.id, content, otp } })

  res.json({ message: 'Confirmation OTP sent', totalAmount })
}

export async function purchaseByOtp(req, res) {
  const { outletId } = req.user
  const { nationalId, otp, confirmOtp, items, paymentMethod, shortfallMethod } = req.body

  if (!nationalId || !otp || !confirmOtp || !items?.length)
    return res.status(400).json({ error: 'nationalId, otp, confirmOtp, and items are required' })

  // verify identity OTP
  const entry = otpStore.get(nationalId)
  if (!entry) return res.status(400).json({ error: 'لم يتم طلب OTP لهذا الرقم القومي' })
  if (Date.now() > entry.expiresAt) { otpStore.delete(nationalId); return res.status(400).json({ error: 'انتهت صلاحية OTP' }) }
  if (entry.otp !== otp) return res.status(400).json({ error: 'رمز OTP غير صحيح' })

  // verify confirmation OTP
  const confirmEntry = confirmStore.get(nationalId)
  if (!confirmEntry) return res.status(400).json({ error: 'لم يتم إرسال رمز تأكيد الشراء — أرسله أولاً' })
  if (Date.now() > confirmEntry.expiresAt) { confirmStore.delete(nationalId); return res.status(400).json({ error: 'انتهت صلاحية رمز تأكيد الشراء' }) }
  if (confirmEntry.otp !== confirmOtp) return res.status(400).json({ error: 'رمز تأكيد الشراء غير صحيح' })

  otpStore.delete(nationalId)
  confirmStore.delete(nationalId)
  await _processPurchase(req, res, { findBy: { nationalId }, items, outletId, paymentMethod: paymentMethod || 'BALANCE', shortfallMethod: shortfallMethod || null })
}

// ─── Method 2: Card PIN ──────────────────────────────────────────────────────

export async function lookupByPin(req, res) {
  const { cardPin } = req.body
  if (!cardPin) return res.status(400).json({ error: 'cardPin is required' })

  const user = await prisma.user.findFirst({
    where: { cardPin },
    select: { id: true, name: true, tamweenCardId: true, monthlyCredit: true, usedCredit: true },
  })
  if (!user) return res.status(404).json({ error: 'رمز الكارت غير صحيح' })
  res.json({ ...user, remainingCredit: user.monthlyCredit - user.usedCredit })
}

export async function purchaseByPin(req, res) {
  const { outletId } = req.user
  const { cardPin, items, paymentMethod, shortfallMethod } = req.body

  if (!cardPin || !items?.length)
    return res.status(400).json({ error: 'cardPin and items are required' })

  const user = await prisma.user.findFirst({ where: { cardPin } })
  if (!user) return res.status(404).json({ error: 'رمز الكارت غير صحيح' })

  await _processPurchase(req, res, { findBy: { id: user.id }, items, outletId, paymentMethod: paymentMethod || 'BALANCE', shortfallMethod: shortfallMethod || null })
}

// ─── Method 3: Guest (non-registered) ───────────────────────────────────────

export async function guestPurchase(req, res) {
  const { outletId } = req.user
  const { items, paymentMethod = 'CASH' } = req.body

  if (!items?.length) return res.status(400).json({ error: 'items are required' })
  if (paymentMethod === 'BALANCE') return res.status(400).json({ error: 'غير المسجلين لا يمكنهم الدفع بالرصيد' })

  let totalAmount = 0
  const validatedItems = []

  for (const item of items) {
    const op = await prisma.outletProduct.findUnique({
      where: { outletId_productId: { outletId, productId: item.productId } },
      include: { product: true },
    })
    if (!op) return res.status(400).json({ error: `المنتج غير موجود في هذا المنفذ` })
    if (op.quantity < item.quantity) return res.status(400).json({ error: `الكمية غير كافية: ${op.product.name}` })
    validatedItems.push({ op, quantity: item.quantity })
    totalAmount += op.pricePerUnit * item.quantity
  }

  const purchase = await prisma.$transaction(async (tx) => {
    const p = await tx.purchase.create({
      data: {
        outletId, type: 'ONSITE', totalAmount, status: 'CONFIRMED', paymentMethod,
        items: { create: validatedItems.map(({ op, quantity }) => ({ productId: op.productId, quantity, unitPrice: op.pricePerUnit })) },
      },
      include: { items: { include: { product: true } } },
    })
    for (const { op, quantity } of validatedItems)
      await tx.outletProduct.update({ where: { outletId_productId: { outletId, productId: op.productId } }, data: { quantity: { decrement: quantity } } })
    return p
  })

  const io = req.app.get('io')
  if (io) {
    io.to(`outlet:${outletId}`).emit('purchase-recorded', {
      purchaseId: purchase.id, userName: 'غير مسجل', totalAmount,
      items: purchase.items.map((i) => ({ product: i.product.name, quantity: i.quantity })),
    })
    for (const { op } of validatedItems) {
      const updated = await prisma.outletProduct.findUnique({ where: { outletId_productId: { outletId, productId: op.productId } }, include: { product: true } })
      if (updated && updated.quantity <= updated.minThreshold)
        io.to(`outlet:${outletId}`).emit('low-stock', { product: updated.product.name, remaining: updated.quantity, minThreshold: updated.minThreshold })
    }
    io.to('admin').emit('purchase-recorded', { outletId, totalAmount })
  }

  res.status(201).json({
    message: 'Purchase recorded successfully',
    purchaseId: purchase.id,
    totalAmount,
    paymentMethod,
    items: purchase.items.map((i) => ({ product: i.product.name, quantity: i.quantity, unitPrice: i.unitPrice })),
  })
}

// ─── Method 4: QR Complete (outlet confirms after citizen QR-authenticated) ──

export async function qrCompletePurchase(req, res) {
  const { outletId } = req.user
  const { nationalId, confirmOtp, items, paymentMethod, shortfallMethod } = req.body

  if (!nationalId || !confirmOtp || !items?.length)
    return res.status(400).json({ error: 'nationalId, confirmOtp, and items are required' })

  // Check QR session (don't delete yet — confirmOtp must pass first)
  const auth = qrAuthStore.get(outletId)
  if (!auth) return res.status(400).json({ error: 'لم يتم تسجيل العميل عبر QR أو انتهت الجلسة' })
  if (Date.now() > auth.expiresAt) { qrAuthStore.delete(outletId); return res.status(400).json({ error: 'انتهت جلسة QR — اطلب من العميل المسح مجدداً' }) }
  if (auth.nationalId !== nationalId) return res.status(400).json({ error: 'رقم قومي غير متطابق' })

  // Verify purchase confirmation OTP
  const confirmEntry = confirmStore.get(nationalId)
  if (!confirmEntry) return res.status(400).json({ error: 'لم يتم إرسال رمز تأكيد الشراء — أرسله أولاً' })
  if (Date.now() > confirmEntry.expiresAt) { confirmStore.delete(nationalId); return res.status(400).json({ error: 'انتهت صلاحية رمز تأكيد الشراء' }) }
  if (confirmEntry.otp !== confirmOtp) return res.status(400).json({ error: 'رمز تأكيد الشراء غير صحيح' })

  // Both verified — clear stores
  qrAuthStore.delete(outletId)
  confirmStore.delete(nationalId)

  await _processPurchase(req, res, {
    findBy: { nationalId },
    items, outletId,
    paymentMethod: paymentMethod || 'BALANCE',
    shortfallMethod: shortfallMethod || null,
  })
}

// ─── Existing: purchase by tamween card ID ───────────────────────────────────

export async function recordPurchase(req, res) {
  const { outletId } = req.user
  const { tamweenCardId, items } = req.body

  if (!tamweenCardId || !items?.length)
    return res.status(400).json({ error: 'tamweenCardId and items are required' })

  await _processPurchase(req, res, { findBy: { tamweenCardId }, items, outletId })
}

// ─── Shared purchase logic ───────────────────────────────────────────────────

async function _processPurchase(req, res, { findBy, items, outletId, paymentMethod = 'BALANCE', shortfallMethod = null }) {
  const user = await prisma.user.findUnique({ where: findBy })
  if (!user) return res.status(404).json({ error: 'User not found' })

  const useBalance = paymentMethod === 'BALANCE'
  const remaining = user.monthlyCredit - user.usedCredit

  if (useBalance && remaining <= 0 && !shortfallMethod)
    return res.status(400).json({ error: 'لا يوجد رصيد متبقي هذا الشهر' })

  let totalAmount = 0
  const validatedItems = []

  for (const item of items) {
    const op = await prisma.outletProduct.findUnique({
      where: { outletId_productId: { outletId, productId: item.productId } },
      include: { product: true },
    })
    if (!op) return res.status(400).json({ error: `المنتج غير موجود في هذا المنفذ` })
    if (op.quantity < item.quantity) return res.status(400).json({ error: `الكمية غير كافية: ${op.product.name}` })
    validatedItems.push({ op, quantity: item.quantity })
    totalAmount += op.pricePerUnit * item.quantity
  }

  const shortfall = useBalance ? Math.max(0, totalAmount - remaining) : 0

  // reject only if no shortfallMethod provided to cover the difference
  if (useBalance && shortfall > 0 && !shortfallMethod)
    return res.status(400).json({
      error: `الرصيد غير كافٍ. المطلوب: ${totalAmount} جنيه، المتاح: ${remaining.toFixed(2)} جنيه، الفرق: ${shortfall.toFixed(2)} جنيه`,
      shortfall,
    })

  const balanceDeducted = useBalance ? Math.min(remaining, totalAmount) : 0

  const purchase = await prisma.$transaction(async (tx) => {
    const p = await tx.purchase.create({
      data: {
        userId: user.id, outletId, type: 'ONSITE', totalAmount, status: 'CONFIRMED',
        paymentMethod,
        extraPaymentMethod: shortfall > 0 ? shortfallMethod : null,
        extraAmount: shortfall > 0 ? shortfall : null,
        items: { create: validatedItems.map(({ op, quantity }) => ({ productId: op.productId, quantity, unitPrice: op.pricePerUnit })) },
      },
      include: { items: { include: { product: true } }, user: { select: { name: true, tamweenCardId: true } } },
    })
    for (const { op, quantity } of validatedItems)
      await tx.outletProduct.update({ where: { outletId_productId: { outletId, productId: op.productId } }, data: { quantity: { decrement: quantity } } })
    if (useBalance && balanceDeducted > 0)
      await tx.user.update({ where: { id: user.id }, data: { usedCredit: { increment: balanceDeducted } } })
    return p
  })

  const io = req.app.get('io')
  if (io) {
    io.to(`outlet:${outletId}`).emit('purchase-recorded', {
      purchaseId: purchase.id, userName: purchase.user.name, totalAmount,
      items: purchase.items.map((i) => ({ product: i.product.name, quantity: i.quantity })),
    })
    for (const { op } of validatedItems) {
      const updated = await prisma.outletProduct.findUnique({ where: { outletId_productId: { outletId, productId: op.productId } }, include: { product: true } })
      if (updated && updated.quantity <= updated.minThreshold)
        io.to(`outlet:${outletId}`).emit('low-stock', { product: updated.product.name, remaining: updated.quantity, minThreshold: updated.minThreshold })
    }
    io.to('admin').emit('purchase-recorded', { outletId, totalAmount })
  }

  res.status(201).json({
    message: 'Purchase recorded successfully',
    purchaseId: purchase.id,
    user: {
      name: purchase.user.name,
      tamweenCardId: purchase.user.tamweenCardId,
      remainingCredit: useBalance
        ? user.monthlyCredit - user.usedCredit - balanceDeducted
        : user.monthlyCredit - user.usedCredit,
    },
    totalAmount,
    paymentMethod,
    shortfall: shortfall > 0 ? shortfall : 0,
    shortfallMethod: shortfall > 0 ? shortfallMethod : null,
    balanceDeducted,
    items: purchase.items.map((i) => ({ product: i.product.name, quantity: i.quantity, unitPrice: i.unitPrice })),
  })
}
