import prisma from '../lib/prisma.js'

const qrOtpStore  = new Map()  // nationalId  -> { otp, expiresAt }
export const qrAuthStore = new Map() // outletId -> { user, nationalId, expiresAt }

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export function getAndClearQrAuth(outletId) {
  const auth = qrAuthStore.get(outletId)
  if (!auth) return null
  if (Date.now() > auth.expiresAt) { qrAuthStore.delete(outletId); return null }
  qrAuthStore.delete(outletId)
  return auth
}

// Public: get outlet info + products (citizen scanned QR, now loads the page)
export async function getOutletProducts(req, res) {
  const { outletId } = req.params
  const outlet = await prisma.outlet.findUnique({
    where: { id: outletId },
    include: { products: { include: { product: true } } },
  })
  if (!outlet || !outlet.isActive) return res.status(404).json({ error: 'المنفذ غير موجود أو غير نشط' })

  res.json({
    id: outlet.id,
    name: outlet.name,
    address: outlet.address,
    products: outlet.products.map(op => ({
      productId: op.productId,
      name: op.product.name,
      unit: op.product.unit,
      category: op.product.category,
      pricePerUnit: op.pricePerUnit,
      quantity: op.quantity,
    })),
  })
}

// Public: citizen requests identity OTP using national ID
export async function qrRequestOtp(req, res) {
  const { nationalId } = req.body
  if (!nationalId) return res.status(400).json({ error: 'nationalId is required' })

  const user = await prisma.user.findUnique({
    where: { nationalId },
    select: { id: true, name: true, tamweenCardId: true, monthlyCredit: true, usedCredit: true },
  })
  if (!user) return res.status(404).json({ error: 'لا يوجد مواطن بهذا الرقم القومي' })

  const otp = generateOtp()
  qrOtpStore.set(nationalId, { otp, expiresAt: Date.now() + 5 * 60 * 1000 })

  await prisma.message.create({
    data: {
      userId: user.id,
      content: `رمز التحقق لشراء QR من منفذ التموين: ${otp} — صالح لمدة 5 دقائق`,
      otp,
    },
  })

  res.json({ message: 'OTP sent', userName: user.name, otp })
}

// Public: citizen verifies OTP and gets their info
export async function qrVerifyOtp(req, res) {
  const { nationalId, otp } = req.body
  if (!nationalId || !otp) return res.status(400).json({ error: 'nationalId and otp are required' })

  const entry = qrOtpStore.get(nationalId)
  if (!entry) return res.status(400).json({ error: 'لم يتم طلب OTP لهذا الرقم القومي' })
  if (Date.now() > entry.expiresAt) { qrOtpStore.delete(nationalId); return res.status(400).json({ error: 'انتهت صلاحية OTP' }) }
  if (entry.otp !== otp) return res.status(400).json({ error: 'رمز OTP غير صحيح' })

  const user = await prisma.user.findUnique({
    where: { nationalId },
    select: { id: true, name: true, tamweenCardId: true, monthlyCredit: true, usedCredit: true },
  })
  res.json({ ...user, remainingCredit: user.monthlyCredit - user.usedCredit })
}

// Authenticated USER scans QR — identity taken from JWT, no manual entry
export async function qrScan(req, res) {
  const { outletId } = req.body
  if (!outletId) return res.status(400).json({ error: 'outletId is required' })

  const outlet = await prisma.outlet.findUnique({ where: { id: outletId } })
  if (!outlet || !outlet.isActive) return res.status(404).json({ error: 'المنفذ غير موجود أو غير نشط' })

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true, tamweenCardId: true, nationalId: true, monthlyCredit: true, usedCredit: true },
  })
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' })

  const remaining = user.monthlyCredit - user.usedCredit
  qrAuthStore.set(outletId, {
    user: { ...user, remainingCredit: remaining },
    nationalId: user.nationalId,
    expiresAt: Date.now() + 5 * 60 * 1000,
  })

  const io = req.app.get('io')
  if (io) io.to(`outlet:${outletId}`).emit('qr-authenticated', { ...user, remainingCredit: remaining, nationalId: user.nationalId })

  res.json({ message: `تم التسجيل في ${outlet.name}`, outletName: outlet.name, userName: user.name })
}

// Public: citizen authenticates — outlet gets notified via socket
export async function qrAuthenticate(req, res) {
  const { outletId, nationalId, otp } = req.body
  if (!outletId || !nationalId || !otp) return res.status(400).json({ error: 'outletId, nationalId, otp مطلوبة' })

  const entry = qrOtpStore.get(nationalId)
  if (!entry) return res.status(400).json({ error: 'لم يتم طلب OTP لهذا الرقم القومي' })
  if (Date.now() > entry.expiresAt) { qrOtpStore.delete(nationalId); return res.status(400).json({ error: 'انتهت صلاحية OTP' }) }
  if (entry.otp !== otp) return res.status(400).json({ error: 'رمز OTP غير صحيح' })
  qrOtpStore.delete(nationalId)

  const user = await prisma.user.findUnique({
    where: { nationalId },
    select: { id: true, name: true, tamweenCardId: true, monthlyCredit: true, usedCredit: true },
  })
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' })

  const remaining = user.monthlyCredit - user.usedCredit
  qrAuthStore.set(outletId, { user: { ...user, remainingCredit: remaining }, nationalId, expiresAt: Date.now() + 5 * 60 * 1000 })

  const io = req.app.get('io')
  if (io) io.to(`outlet:${outletId}`).emit('qr-authenticated', { ...user, remainingCredit: remaining, nationalId })

  res.json({ message: '✅ تم التحقق بنجاح — ابدأ الشراء الآن مع موظف المنفذ' })
}

// Public: citizen completes purchase (self-service via QR) — KEPT FOR FALLBACK
export async function qrPurchase(req, res) {
  const { outletId, nationalId, otp, items, paymentMethod = 'BALANCE' } = req.body
  if (!outletId || !nationalId || !otp || !items?.length)
    return res.status(400).json({ error: 'outletId, nationalId, otp, and items are required' })

  // verify OTP
  const entry = qrOtpStore.get(nationalId)
  if (!entry) return res.status(400).json({ error: 'لم يتم التحقق من الهوية — أرسل OTP أولاً' })
  if (Date.now() > entry.expiresAt) { qrOtpStore.delete(nationalId); return res.status(400).json({ error: 'انتهت صلاحية OTP' }) }
  if (entry.otp !== otp) return res.status(400).json({ error: 'رمز OTP غير صحيح' })
  qrOtpStore.delete(nationalId)

  const outlet = await prisma.outlet.findUnique({ where: { id: outletId } })
  if (!outlet) return res.status(404).json({ error: 'المنفذ غير موجود' })

  const user = await prisma.user.findUnique({ where: { nationalId } })
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' })

  const useBalance = paymentMethod === 'BALANCE'
  const remaining = user.monthlyCredit - user.usedCredit

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

  if (useBalance && totalAmount > remaining)
    return res.status(400).json({
      error: `الرصيد غير كافٍ. المطلوب: ${totalAmount.toFixed(2)} جنيه، المتاح: ${remaining.toFixed(2)} جنيه`,
    })

  const balanceDeducted = useBalance ? totalAmount : 0

  const purchase = await prisma.$transaction(async (tx) => {
    const p = await tx.purchase.create({
      data: {
        userId: user.id, outletId, type: 'ONSITE', totalAmount, status: 'CONFIRMED',
        paymentMethod,
        items: { create: validatedItems.map(({ op, quantity }) => ({ productId: op.productId, quantity, unitPrice: op.pricePerUnit })) },
      },
      include: { items: { include: { product: true } } },
    })
    for (const { op, quantity } of validatedItems)
      await tx.outletProduct.update({ where: { outletId_productId: { outletId, productId: op.productId } }, data: { quantity: { decrement: quantity } } })
    if (useBalance && balanceDeducted > 0)
      await tx.user.update({ where: { id: user.id }, data: { usedCredit: { increment: balanceDeducted } } })
    return p
  })

  res.status(201).json({
    message: 'تمت عملية الشراء بنجاح',
    purchaseId: purchase.id,
    totalAmount,
    paymentMethod,
    remainingCredit: useBalance ? remaining - balanceDeducted : remaining,
  })
}
