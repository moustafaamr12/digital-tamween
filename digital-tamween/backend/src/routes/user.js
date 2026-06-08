import { Router } from 'express'
import { authenticate, requireRole } from '../middleware/auth.js'
import { getProfile, getOutlets, getOutletById, getPurchaseHistory, orderDelivery, getDeliveryOrders, getMessages } from '../controllers/user.controller.js'

const router = Router()
router.use(authenticate, requireRole('USER'))

router.get('/profile',         getProfile)
router.get('/outlets',         getOutlets)
router.get('/outlets/:id',     getOutletById)
router.get('/purchases',       getPurchaseHistory)
router.post('/order-delivery', orderDelivery)
router.get('/deliveries',      getDeliveryOrders)
router.get('/messages',        getMessages)

export default router
