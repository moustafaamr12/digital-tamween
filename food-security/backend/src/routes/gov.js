import { Router } from 'express'
import { getRegions, getRegionById, getConvoys, getStats } from '../controllers/gov.controller.js'

const router = Router()

router.get('/regions', getRegions)
router.get('/regions/:id', getRegionById)
router.get('/convoys', getConvoys)
router.get('/stats', getStats)

export default router
