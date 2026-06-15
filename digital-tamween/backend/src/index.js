import 'dotenv/config'
import { createServer } from 'http'
import { Server } from 'socket.io'
import app from './app.js'
import prisma from './lib/prisma.js'

const PORT = process.env.PORT || 3000

const server = createServer(app)
const io = new Server(server, { cors: { origin: '*' } })

app.set('io', io)

io.on('connection', (socket) => {
  socket.on('join-outlet', (outletId) => socket.join(`outlet:${outletId}`))
  socket.on('join-admin', () => socket.join('admin'))
})

server.listen(PORT, async () => {
  await prisma.$connect()
  console.log(`Server running on http://localhost:${PORT}`)
})

process.on('SIGINT', async () => {
  await prisma.$disconnect()
  process.exit(0)
})
