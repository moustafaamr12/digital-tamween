import { Router } from 'express'
import { authenticate, requireRole } from '../middleware/auth.js'
import { getOutletProfile, getInventory, getSalesHistory, getRestockHistory, addRestock, getDeliveryOrders, updateDeliveryStatus, confirmDelivery } from '../controllers/outlet.controller.js'

const router = Router()
router.use(authenticate, requireRole('OUTLET_OWNER'))

router.get('/profile',              getOutletProfile)
router.get('/inventory',            getInventory)
router.get('/sales',                getSalesHistory)
router.get('/restocks',             getRestockHistory)
router.post('/restocks',            addRestock)
router.get('/deliveries',           getDeliveryOrders)
router.patch('/deliveries/:id',     updateDeliveryStatus)
router.post('/deliveries/:id/confirm', confirmDelivery)

export default router
