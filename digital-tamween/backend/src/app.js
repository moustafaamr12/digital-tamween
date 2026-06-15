import express from 'express'
import cors from 'cors'
import authRoutes   from './routes/auth.js'
import userRoutes   from './routes/user.js'
import outletRoutes from './routes/outlet.js'
import adminRoutes  from './routes/admin.js'
import posRoutes    from './routes/pos.js'
import qrRoutes     from './routes/qr.js'

const app = express()

app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.use('/auth',   authRoutes)
app.use('/user',   userRoutes)
app.use('/outlet', outletRoutes)
app.use('/admin',  adminRoutes)
app.use('/pos',    posRoutes)
app.use('/qr',     qrRoutes)

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' })
})

export default app
