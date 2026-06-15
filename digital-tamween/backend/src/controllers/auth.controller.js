import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma.js'

export async function login(req, res) {
  const { role, identifier, password } = req.body

  if (!role || !identifier || !password) {
    return res.status(400).json({ error: 'role, identifier, and password are required' })
  }

  let account = null
  let tokenPayload = null

  if (role === 'USER') {
    account = await prisma.user.findUnique({ where: { nationalId: identifier } })
    if (account) tokenPayload = { id: account.id, role: 'USER', name: account.name }

  } else if (role === 'OUTLET_OWNER') {
    account = await prisma.outletOwner.findUnique({
      where: { email: identifier },
      include: { outlet: true },
    })
    if (account) {
      tokenPayload = { id: account.id, role: 'OUTLET_OWNER', name: account.name, outletId: account.outletId }
    }

  } else if (role === 'ADMIN') {
    account = await prisma.admin.findUnique({ where: { email: identifier } })
    if (account) tokenPayload = { id: account.id, role: 'ADMIN', name: account.name }

  } else {
    return res.status(400).json({ error: 'Invalid role' })
  }

  if (!account) return res.status(401).json({ error: 'Invalid credentials' })

  const valid = await bcrypt.compare(password, account.passwordHash)
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

  const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })

  res.json({ token, user: tokenPayload })
}
