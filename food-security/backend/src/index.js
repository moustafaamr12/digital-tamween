import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import govRoutes from './routes/gov.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.use('/gov', govRoutes)

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'food-security-backend' }))

app.listen(PORT, () => console.log(`Food Security API running on http://localhost:${PORT}`))
