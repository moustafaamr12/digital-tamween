import { Router } from 'express'
import { authenticate, requireRole } from '../middleware/auth.js'
import { lookupUser, recordPurchase, requestOtp, verifyOtp, sendConfirmOtp, purchaseByOtp, lookupByPin, purchaseByPin, guestPurchase, qrCompletePurchase } from '../controllers/pos.controller.js'

const router = Router()
router.use(authenticate, requireRole('OUTLET_OWNER'))

router.get('/user/:tamweenCardId', lookupUser)
router.post('/purchase',           recordPurchase)

// OTP method
router.post('/otp/request',      requestOtp)
router.post('/otp/verify',       verifyOtp)
router.post('/otp/confirm-send', sendConfirmOtp)
router.post('/otp/purchase',     purchaseByOtp)

// Card PIN method
router.post('/card/lookup',   lookupByPin)
router.post('/card/purchase', purchaseByPin)

// Guest (non-registered) method
router.post('/guest/purchase', guestPurchase)

// QR complete (outlet confirms after citizen scanned QR)
router.post('/qr-complete', qrCompletePurchase)

export default router
