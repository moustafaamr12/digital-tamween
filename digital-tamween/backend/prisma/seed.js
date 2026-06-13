import 'dotenv/config'
import bcrypt from 'bcrypt'
import { PrismaClient } from '../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding database...')

  const products = await Promise.all([
    prisma.product.upsert({ where: { name: 'سكر' },      update: {}, create: { name: 'سكر',      unit: 'كجم', category: 'حبوب' } }),
    prisma.product.upsert({ where: { name: 'أرز' },      update: {}, create: { name: 'أرز',      unit: 'كجم', category: 'حبوب' } }),
    prisma.product.upsert({ where: { name: 'زيت طعام' }, update: {}, create: { name: 'زيت طعام', unit: 'لتر', category: 'زيوت' } }),
    prisma.product.upsert({ where: { name: 'دقيق' },     update: {}, create: { name: 'دقيق',     unit: 'كجم', category: 'حبوب' } }),
    prisma.product.upsert({ where: { name: 'شاي' },      update: {}, create: { name: 'شاي',      unit: 'جم',  category: 'مشروبات' } }),
  ])
  console.log(`Created ${products.length} products`)

  // ─── Admins ───────────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash('admin123', 10)
  const adminDefs = [
    { name: 'محمد أحمد - مسئول الوزارة',         email: 'admin@tamween.gov.eg'  },
    { name: 'سمر حسين - مسئولة المتابعة',         email: 'admin2@tamween.gov.eg' },
    { name: 'طارق عبد الرحمن - مسئول الإحصاء',   email: 'admin3@tamween.gov.eg' },
    { name: 'منى السيد - مسئولة المنافذ',         email: 'admin4@tamween.gov.eg' },
  ]
  for (const a of adminDefs) {
    await prisma.admin.upsert({
      where:  { email: a.email },
      update: {},
      create: { name: a.name, email: a.email, passwordHash: adminHash },
    })
  }
  console.log(`Created ${adminDefs.length} admins`)

  // ─── Outlets ──────────────────────────────────────────────────────────────
  const ownerHash = await bcrypt.hash('owner123', 10)
  const outletDefs = [
    { name: 'منفذ التموين - المعادي',       address: 'شارع كورنيش النيل، المعادي، القاهرة',        latitude: 29.9602, longitude: 31.2569, licenseNo: 'CAI-001', phone: '0201234567', ownerName: 'أحمد محمود',      ownerEmail: 'outlet1@tamween.gov.eg' },
    { name: 'منفذ التموين - مدينة نصر',    address: 'شارع عباس العقاد، مدينة نصر، القاهرة',       latitude: 30.0626, longitude: 31.3417, licenseNo: 'CAI-002', phone: '0209876543', ownerName: 'سامي علي',        ownerEmail: 'outlet2@tamween.gov.eg' },
    { name: 'منفذ التموين - الهرم',        address: 'شارع الهرم، الجيزة',                          latitude: 29.9773, longitude: 31.1325, licenseNo: 'GIZ-001', phone: '0201122334', ownerName: 'خالد إبراهيم',    ownerEmail: 'outlet3@tamween.gov.eg' },
    { name: 'منفذ التموين - شبرا',         address: 'شارع شبرا، شبرا الخيمة، القاهرة',            latitude: 30.1286, longitude: 31.2441, licenseNo: 'CAI-003', phone: '0203344556', ownerName: 'عمر فتحي',        ownerEmail: 'outlet4@tamween.gov.eg' },
    { name: 'منفذ التموين - عين شمس',      address: 'شارع الجمهورية، عين شمس، القاهرة',           latitude: 30.1018, longitude: 31.3278, licenseNo: 'CAI-004', phone: '0205566778', ownerName: 'هاني رضا',        ownerEmail: 'outlet5@tamween.gov.eg' },
    { name: 'منفذ التموين - الإسكندرية',   address: 'شارع صفر باشا، المنتزه، الإسكندرية',         latitude: 31.2576, longitude: 29.9553, licenseNo: 'ALX-001', phone: '0203045678', ownerName: 'مروان الشيخ',     ownerEmail: 'outlet6@tamween.gov.eg' },
    { name: 'منفذ التموين - المنصورة',     address: 'شارع الجيش، المنصورة، الدقهلية',             latitude: 31.0364, longitude: 31.3807, licenseNo: 'MNS-001', phone: '0505012345', ownerName: 'ياسر عبد الله',   ownerEmail: 'outlet7@tamween.gov.eg' },
    { name: 'منفذ التموين - أسيوط',        address: 'شارع طلعت حرب، أسيوط',                       latitude: 27.1783, longitude: 31.1859, licenseNo: 'ASY-001', phone: '0882234567', ownerName: 'أشرف مصطفى',      ownerEmail: 'outlet8@tamween.gov.eg' },
    { name: 'منفذ التموين - العريش',        address: 'شارع 23 يوليو، العريش، شمال سيناء',           latitude: 31.1199, longitude: 33.7996, licenseNo: 'SIN-001', phone: '0683456789', ownerName: 'محمد طاهر السيناوي',   ownerEmail: 'outlet9@tamween.gov.eg'  },
    { name: 'منفذ التموين - رفح',           address: 'شارع الجلاء، رفح، شمال سيناء',                latitude: 31.2878, longitude: 34.2482, licenseNo: 'SIN-002', phone: '0683112233', ownerName: 'إبراهيم حمدان البلاح', ownerEmail: 'outlet10@tamween.gov.eg' },
    { name: 'منفذ التموين - بئر العبد',     address: 'مركز بئر العبد، شمال سيناء',                  latitude: 30.9186, longitude: 33.0152, licenseNo: 'SIN-003', phone: '0683223344', ownerName: 'عيد نصر الغنيمي',     ownerEmail: 'outlet11@tamween.gov.eg' },
    { name: 'منفذ التموين - نخل',           address: 'قرية نخل، وسط سيناء، شمال سيناء',             latitude: 29.9201, longitude: 33.7706, licenseNo: 'SIN-004', phone: '0683334455', ownerName: 'سلامة عطا الصواركة',  ownerEmail: 'outlet12@tamween.gov.eg' },
    { name: 'منفذ التموين - سانت كاترين',   address: 'قرية سانت كاترين، جنوب سيناء',                latitude: 28.5566, longitude: 33.9760, licenseNo: 'SSI-001', phone: '0692112233', ownerName: 'جرجس سمعان نصير',     ownerEmail: 'outlet13@tamween.gov.eg' },
    { name: 'منفذ التموين - طابا',          address: 'منطقة طابا، الحدود المصرية الإسرائيلية، جنوب سيناء', latitude: 29.4967, longitude: 34.8989, licenseNo: 'SSI-002', phone: '0692223344', ownerName: 'خالد رجب البدوي', ownerEmail: 'outlet14@tamween.gov.eg' },
    { name: 'منفذ التموين - نويبع',         address: 'مدينة نويبع، ساحل خليج العقبة، جنوب سيناء',   latitude: 29.0658, longitude: 34.6683, licenseNo: 'SSI-003', phone: '0692334455', ownerName: 'ماجد عوض الجبلي',     ownerEmail: 'outlet15@tamween.gov.eg' },
    { name: 'منفذ التموين - مرسى علم',      address: 'شارع الكورنيش، مرسى علم، البحر الأحمر',       latitude: 25.0661, longitude: 34.8921, licenseNo: 'RSE-001', phone: '0652112233', ownerName: 'عبد الرحمن نور الدين', ownerEmail: 'outlet16@tamween.gov.eg' },
    { name: 'منفذ التموين - القصير',        address: 'شارع بورسعيد، القصير، البحر الأحمر',          latitude: 26.1016, longitude: 34.2785, licenseNo: 'RSE-002', phone: '0652223344', ownerName: 'يوسف حسن الصعيدي',   ownerEmail: 'outlet17@tamween.gov.eg' },
    { name: 'منفذ التموين - شلاتين',        address: 'قرية شلاتين، الحدود المصرية السودانية، البحر الأحمر', latitude: 23.1300, longitude: 35.6100, licenseNo: 'RSE-003', phone: '0652334455', ownerName: 'عثمان محمد البشاري', ownerEmail: 'outlet18@tamween.gov.eg' },
    { name: 'منفذ التموين - مرسى مطروح',    address: 'شارع الإسكندرية، مرسى مطروح',                 latitude: 31.3525, longitude: 27.2373, licenseNo: 'MAT-001', phone: '0462112233', ownerName: 'إسماعيل حسن المطروحي', ownerEmail: 'outlet19@tamween.gov.eg' },
    { name: 'منفذ التموين - سيوة',          address: 'واحة سيوة، مركز سيوة، مطروح',                 latitude: 29.2037, longitude: 25.5195, licenseNo: 'MAT-002', phone: '0462223344', ownerName: 'برعي سعيد الأمازيغي', ownerEmail: 'outlet20@tamween.gov.eg' },
    { name: 'منفذ التموين - السلوم',        address: 'مدينة السلوم، الحدود المصرية الليبية، مطروح', latitude: 31.5264, longitude: 25.1556, licenseNo: 'MAT-003', phone: '0462334455', ownerName: 'فرج العيسى الحدودي',  ownerEmail: 'outlet21@tamween.gov.eg' },
    { name: 'منفذ التموين - سيدي براني',    address: 'مركز سيدي براني، مطروح',                      latitude: 31.4200, longitude: 25.9000, licenseNo: 'MAT-004', phone: '0462445566', ownerName: 'طارق يوسف الساحلي',  ownerEmail: 'outlet22@tamween.gov.eg' },
    { name: 'منفذ التموين - الخارجة',       address: 'شارع جمال عبد الناصر، الخارجة، الوادي الجديد', latitude: 25.4411, longitude: 30.5487, licenseNo: 'NVL-001', phone: '0922112233', ownerName: 'محمد فوزي الواحاتي',  ownerEmail: 'outlet23@tamween.gov.eg' },
    { name: 'منفذ التموين - الداخلة',       address: 'قرية القصر، مركز الداخلة، الوادي الجديد',     latitude: 25.6800, longitude: 28.8800, licenseNo: 'NVL-002', phone: '0922223344', ownerName: 'حمدي عبد الله النخلاوي', ownerEmail: 'outlet24@tamween.gov.eg' },
    { name: 'منفذ التموين - الفرافرة',      address: 'قصبة الفرافرة، مركز الفرافرة، الوادي الجديد', latitude: 27.0596, longitude: 27.9729, licenseNo: 'NVL-003', phone: '0922334455', ownerName: 'صلاح نصر الفرافري',   ownerEmail: 'outlet25@tamween.gov.eg' },
    { name: 'منفذ التموين - أبو سمبل',      address: 'مدينة أبو سمبل السياحية، مركز أبو سمبل، أسوان', latitude: 22.3411, longitude: 31.6253, licenseNo: 'ASW-002', phone: '0972112233', ownerName: 'نوبي إبراهيم الجزاري', ownerEmail: 'outlet26@tamween.gov.eg' },
    { name: 'منفذ التموين - توشكى',         address: 'نجع توشكى، مشروع توشكى، أسوان',               latitude: 22.7200, longitude: 31.5000, licenseNo: 'ASW-003', phone: '0972223344', ownerName: 'بكر إسماعيل التوشكاوي', ownerEmail: 'outlet27@tamween.gov.eg' },
    { name: 'منفذ التموين - وادي حلفا الجديدة', address: 'مدينة وادي حلفا الجديدة، الحدود المصرية السودانية، أسوان', latitude: 21.7800, longitude: 31.3500, licenseNo: 'ASW-004', phone: '0972334455', ownerName: 'هاني سلمان الحلفاوي', ownerEmail: 'outlet28@tamween.gov.eg' },
  ]

  const prices = { 'سكر': 12.5, 'أرز': 15.0, 'زيت طعام': 35.0, 'دقيق': 10.0, 'شاي': 20.0 }

  for (const o of outletDefs) {
    const outlet = await prisma.outlet.upsert({
      where:  { licenseNo: o.licenseNo },
      update: {},
      create: { name: o.name, address: o.address, latitude: o.latitude, longitude: o.longitude, licenseNo: o.licenseNo, phone: o.phone },
    })
    await prisma.outletOwner.upsert({
      where:  { email: o.ownerEmail },
      update: {},
      create: { name: o.ownerName, email: o.ownerEmail, passwordHash: ownerHash, outletId: outlet.id },
    })
    for (const product of products) {
      await prisma.outletProduct.upsert({
        where:  { outletId_productId: { outletId: outlet.id, productId: product.id } },
        update: {},
        create: { outletId: outlet.id, productId: product.id, quantity: Math.floor(Math.random() * 200) + 50, minThreshold: 20, pricePerUnit: prices[product.name] ?? 10 },
      })
    }
  }
  console.log(`Created ${outletDefs.length} outlets (including border/remote areas)`)

  // ─── Citizens (login by nationalId) ───────────────────────────────────────
  const userHash = await bcrypt.hash('user123', 10)
  // email: ~25 have email, ~15 don't   |   needScore: random 10-95 per person
  const userDefs = [
    { name: 'علي حسن محمد',          nationalId: '29901011234567', tamweenCardId: 'TMW-0001', phone: '01011111111', address: 'شارع النصر، المعادي',                           cardPin: '1234', email: 'ali.hassan@gmail.com',      needScore: 35.2 },
    { name: 'فاطمة أحمد علي',        nationalId: '30005152345678', tamweenCardId: 'TMW-0002', phone: '01022222222', address: 'شارع عباس العقاد، مدينة نصر',                   cardPin: '5678', email: 'fatma.ahmed@yahoo.com',     needScore: 42.8 },
    { name: 'محمد سعيد إبراهيم',     nationalId: '28807203456789', tamweenCardId: 'TMW-0003', phone: '01033333333', address: 'شارع الهرم، الجيزة',                             cardPin: '9021', email: null,                        needScore: 67.5 },
    { name: 'نورا سعيد عمر',         nationalId: '30003102345670', tamweenCardId: 'TMW-0004', phone: '01044444444', address: 'شارع شبرا الرئيسي، القاهرة',                    cardPin: '2345', email: 'noura.saeed@gmail.com',     needScore: 58.1 },
    { name: 'كريم طارق حسن',         nationalId: '29506075678901', tamweenCardId: 'TMW-0005', phone: '01055555555', address: 'شارع الجمهورية، عين شمس',                       cardPin: '6789', email: null,                        needScore: 44.3 },
    { name: 'هدى رضا محمد',          nationalId: '29811209012345', tamweenCardId: 'TMW-0006', phone: '01066666666', address: 'شارع صفر باشا، الإسكندرية',                     cardPin: '3456', email: 'hoda.reda@hotmail.com',     needScore: 31.9 },
    { name: 'عمر خالد عبد الله',     nationalId: '30108123456781', tamweenCardId: 'TMW-0007', phone: '01077777777', address: 'شارع الجيش، المنصورة',                          cardPin: '7890', email: 'omar.khaled@gmail.com',     needScore: 53.6 },
    { name: 'سارة مصطفى أحمد',       nationalId: '29702285432109', tamweenCardId: 'TMW-0008', phone: '01088888888', address: 'شارع طلعت حرب، أسيوط',                          cardPin: '4321', email: null,                        needScore: 76.4 },
    { name: 'يوسف عصام علي',         nationalId: '30205176789012', tamweenCardId: 'TMW-0009', phone: '01099999999', address: 'شارع كورنيش النيل، المعادي',                    cardPin: '8765', email: 'youssef.essam@gmail.com',   needScore: 29.7 },
    { name: 'إسلام ناصر بسيوني',     nationalId: '29312091500672', tamweenCardId: 'TMW-0010', phone: '01000907715', address: 'كفر الشيخ، دسوق، أمام السجل التجاري',           cardPin: '3571', email: 'islam.nasser@gmail.com',    needScore: 82.3 },
    { name: 'أحمد محمود السيد',       nationalId: '29408251201234', tamweenCardId: 'TMW-0011', phone: '01111112222', address: 'شارع رمسيس، وسط البلد، القاهرة',                cardPin: '2468', email: 'ahmed.mahmoud@outlook.com', needScore: 39.5 },
    { name: 'منى عبد العزيز حسن',    nationalId: '29705142101567', tamweenCardId: 'TMW-0012', phone: '01122223333', address: 'شارع فيصل، الهرم، الجيزة',                      cardPin: '1357', email: null,                        needScore: 51.7 },
    { name: 'تامر حسام الدين',        nationalId: '30001083401890', tamweenCardId: 'TMW-0013', phone: '01133334444', address: 'شارع مكرم عبيد، مدينة نصر، القاهرة',            cardPin: '9753', email: 'tamer.hossam@gmail.com',    needScore: 33.2 },
    { name: 'ريم أحمد فوزي',          nationalId: '29810042102234', tamweenCardId: 'TMW-0014', phone: '01144445555', address: 'شارع الكورنيش، المنتزه، الإسكندرية',           cardPin: '8642', email: 'reem.ahmed@yahoo.com',      needScore: 27.8 },
    { name: 'مصطفى رأفت إبراهيم',    nationalId: '29603152203345', tamweenCardId: 'TMW-0015', phone: '01155556666', address: 'شارع فوزي معاذ، سموحة، الإسكندرية',             cardPin: '7531', email: null,                        needScore: 24.6 },
    { name: 'دينا كمال مصطفى',        nationalId: '30102081201456', tamweenCardId: 'TMW-0016', phone: '01166667777', address: 'شارع المحطة، المنصورة، الدقهلية',              cardPin: '6420', email: 'dina.kamal@gmail.com',      needScore: 48.9 },
    { name: 'وليد سمير أحمد',         nationalId: '29412151601567', tamweenCardId: 'TMW-0017', phone: '01177778888', address: 'شارع سعد زغلول، طنطا، الغربية',               cardPin: '5319', email: null,                        needScore: 55.3 },
    { name: 'نهال محمد إسماعيل',      nationalId: '29907221301678', tamweenCardId: 'TMW-0018', phone: '01188889999', address: 'شارع الجمهورية، الزقازيق، الشرقية',            cardPin: '4208', email: 'nehal.mohammed@gmail.com',  needScore: 61.7 },
    { name: 'عصام فؤاد عبد الله',    nationalId: '28811132601789', tamweenCardId: 'TMW-0019', phone: '01199990000', address: 'شارع الجمهورية، سوهاج',                         cardPin: '3197', email: null,                        needScore: 78.2 },
    { name: 'أسماء علي محمود',        nationalId: '29601142701890', tamweenCardId: 'TMW-0020', phone: '01200001111', address: 'شارع بورسعيد، قنا',                             cardPin: '2086', email: 'asmaa.ali@hotmail.com',     needScore: 73.4 },
    { name: 'رامي عيد حسن',           nationalId: '29904163401901', tamweenCardId: 'TMW-0021', phone: '01211112222', address: 'شارع ثلاثين، العريش، شمال سيناء',              cardPin: '1975', email: null,                        needScore: 85.6 },
    { name: 'سهير محمود طاهر',        nationalId: '30010263201012', tamweenCardId: 'TMW-0022', phone: '01222223333', address: 'قرية الفرافرة، الوادي الجديد',                  cardPin: '8864', email: 'sohair.mahmoud@gmail.com',  needScore: 91.2 },
    { name: 'حسن عبد الرحمن سالم',    nationalId: '29703082501123', tamweenCardId: 'TMW-0023', phone: '01233334444', address: 'شارع الأهرام، الجيزة',                          cardPin: '7753', email: null,                        needScore: 40.1 },
    { name: 'إيمان صالح عمر',         nationalId: '30205222901234', tamweenCardId: 'TMW-0024', phone: '01244445555', address: 'شارع الأقصر، الأقصر',                           cardPin: '6642', email: 'iman.saleh@gmail.com',      needScore: 69.8 },
    { name: 'خالد نبيل فرحات',        nationalId: '29609121401345', tamweenCardId: 'TMW-0025', phone: '01255556666', address: 'شارع القليوبية، بنها، القليوبية',               cardPin: '5531', email: 'khaled.nabil@outlook.com',  needScore: 36.4 },
    { name: 'شيماء حسين محمد',        nationalId: '29806242301456', tamweenCardId: 'TMW-0026', phone: '01266667777', address: 'شارع الفيوم، الفيوم',                           cardPin: '4420', email: null,                        needScore: 64.5 },
    { name: 'طارق عادل منصور',        nationalId: '29511011901567', tamweenCardId: 'TMW-0027', phone: '01277778888', address: 'شارع الإسماعيلية، الإسماعيلية',               cardPin: '3309', email: 'tarek.adel@gmail.com',      needScore: 45.8 },
    { name: 'نادية رشاد سليم',        nationalId: '29804171101678', tamweenCardId: 'TMW-0028', phone: '01288889999', address: 'شارع الجيش، دمياط',                            cardPin: '2198', email: null,                        needScore: 52.3 },
    { name: 'محمود أسامة زكي',        nationalId: '30007292401789', tamweenCardId: 'TMW-0029', phone: '01299990000', address: 'شارع المنيا، المنيا',                           cardPin: '1087', email: 'mahmoud.osama@gmail.com',   needScore: 71.9 },
    { name: 'رانيا جمال الدين',       nationalId: '29712032901890', tamweenCardId: 'TMW-0030', phone: '01300001111', address: 'شارع الأقصر القديم، الأقصر',                   cardPin: '9976', email: null,                        needScore: 66.2 },
    { name: 'سامح ناصر عبده',         nationalId: '29408140301901', tamweenCardId: 'TMW-0031', phone: '01311112222', address: 'شارع بورسعيد القديم، بورسعيد',                 cardPin: '8865', email: 'sameh.nasser@yahoo.com',    needScore: 43.7 },
    { name: 'ياسمين حمدي سعد',        nationalId: '30108291801012', tamweenCardId: 'TMW-0032', phone: '01322223333', address: 'شارع البحيرة، دمنهور، البحيرة',                cardPin: '7754', email: null,                        needScore: 57.4 },
    { name: 'عماد فريد حلمي',         nationalId: '29606183301123', tamweenCardId: 'TMW-0033', phone: '01333334444', address: 'شارع مرسى مطروح، مطروح',                       cardPin: '6643', email: 'emad.farid@gmail.com',      needScore: 83.8 },
    { name: 'هبة الله عثمان',         nationalId: '30003053101234', tamweenCardId: 'TMW-0034', phone: '01344445555', address: 'شارع البحر الأحمر، الغردقة',                   cardPin: '5532', email: null,                        needScore: 38.5 },
    { name: 'أيمن رضوان فتحي',        nationalId: '29801241201345', tamweenCardId: 'TMW-0035', phone: '01355556666', address: 'شارع شبرا الخيمة، القاهرة',                   cardPin: '4421', email: 'ayman.radwan@gmail.com',    needScore: 47.2 },
    { name: 'صفاء محمد الشربيني',     nationalId: '29910171501456', tamweenCardId: 'TMW-0036', phone: '01366667777', address: 'شارع كفر الشيخ، كفر الشيخ',                   cardPin: '3310', email: null,                        needScore: 79.6 },
    { name: 'بسمة أحمد الغنيمي',      nationalId: '30204062801567', tamweenCardId: 'TMW-0037', phone: '01377778888', address: 'شارع عمر بن الخطاب، أسوان',                   cardPin: '2209', email: 'basma.ahmed@hotmail.com',   needScore: 72.1 },
    { name: 'حازم سعيد العطار',       nationalId: '29507252201678', tamweenCardId: 'TMW-0038', phone: '01388889999', address: 'شارع بني سويف، بني سويف',                      cardPin: '1098', email: null,                        needScore: 68.3 },
    { name: 'ولاء حسن إبراهيم',       nationalId: '29903041701789', tamweenCardId: 'TMW-0039', phone: '01399990000', address: 'شارع المنوفية، شبين الكوم',                   cardPin: '9087', email: 'walaa.hassan@gmail.com',    needScore: 54.9 },
    { name: 'كريستينا وصفي ميخائيل',  nationalId: '30106142601890', tamweenCardId: 'TMW-0040', phone: '01400001111', address: 'شارع سوهاج الجديد، سوهاج',                    cardPin: '8076', email: 'kristina.wasfi@yahoo.com',  needScore: 63.5 },
  ]

  for (const u of userDefs) {
    const { email, needScore, ...rest } = u
    await prisma.user.upsert({
      where:  { tamweenCardId: u.tamweenCardId },
      update: { nationalId: u.nationalId, cardPin: u.cardPin, phone: u.phone, address: u.address, email: email ?? null, needScore: needScore ?? 50 },
      create: { ...rest, email: email ?? null, needScore: needScore ?? 50, passwordHash: userHash, monthlyCredit: 200, usedCredit: 0 },
    })
  }
  console.log(`Created ${userDefs.length} citizens`)

  console.log('Purchase history preserved — only real app purchases are stored')

  console.log('\n✅ Done! Test credentials:')
  console.log('  Admins:')
  console.log('    admin@tamween.gov.eg  / admin123')
  console.log('    admin2@tamween.gov.eg / admin123')
  console.log('    admin3@tamween.gov.eg / admin123')
  console.log('    admin4@tamween.gov.eg / admin123')
  console.log('  Outlets (password: owner123):')
  for (const o of outletDefs) console.log(`    ${o.ownerEmail}`)
  console.log('  Citizens — login with nationalId / user123:')
  for (const u of userDefs) console.log(`    ${u.nationalId}  (${u.name})  PIN: ${u.cardPin}`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
