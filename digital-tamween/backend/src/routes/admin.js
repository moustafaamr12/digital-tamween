import { Router } from 'express'
import { authenticate, requireRole } from '../middleware/auth.js'
import { getStats, getAllOutlets, getOutletDetail, getOutletSales, getOutletRestocks, getAllUsers, getUserPurchases, initiateRestock, confirmRestock, getPendingRestocks } from '../controllers/admin.controller.js'

const router = Router()
router.use(authenticate, requireRole('ADMIN'))

router.get('/stats',                getStats)
router.get('/outlets',              getAllOutlets)
router.get('/outlets/:id',          getOutletDetail)
router.get('/outlets/:id/sales',    getOutletSales)
router.get('/outlets/:id/restocks', getOutletRestocks)
router.get('/users',                getAllUsers)
router.get('/users/:id/purchases',  getUserPurchases)

// Restock management
router.get('/restocks/pending',       getPendingRestocks)
router.post('/restocks/initiate',     initiateRestock)
router.post('/restocks/:id/confirm',  confirmRestock)

export default router
