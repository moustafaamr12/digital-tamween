import { Router } from 'express'
import { authenticate, requireRole } from '../middleware/auth.js'
import { getOutletProducts, qrScan } from '../controllers/qr.controller.js'

const router = Router()

// Public — outlet info for display only
router.get('/:outletId/products', getOutletProducts)

// Requires USER login — citizen scans QR from their Tamween app session
router.post('/scan', authenticate, requireRole('USER'), qrScan)

export default router
