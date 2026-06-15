import 'dotenv/config'
import bcrypt from 'bcrypt'
import { PrismaClient } from '../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

await prisma.user.deleteMany({ where: { tamweenCardId: 'TMW-0010' } })
console.log('Deleted old TMW-0010')

const userHash = await bcrypt.hash('user123', 10)
await prisma.user.create({
  data: {
    name: 'إسلام ناصر بسيوني',
    nationalId: '29312091500672',
    tamweenCardId: 'TMW-0010',
    phone: '01000907715',
    address: 'كفر الشيخ، دسوق، أمام السجل التجاري',
    cardPin: '3571',
    passwordHash: userHash,
    monthlyCredit: 200,
    usedCredit: 0,
  }
})
console.log('Created Islam Naser Basiouny with nationalId: 29312091500672')
await prisma.$disconnect()
