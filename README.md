# Digital Tamween — Egypt's Unified Digital Government Platform

### Development of Egypt's Unified Digital Government Platform
### Starting with the Digitization of the National Food Ration and Subsidy System

> **DiGiLiANS Nano Degree Capstone Project | June 2026**  
> Track: Big Data / Software Development

---

## Project Vision

This project proves a core principle: **when government data is unified and linked across institutions, AI can turn that data into services impossible to build in isolation.**

We initiated this vision through Egypt's food subsidy sector by building two integrated systems:

1. **Digital Tamween** — Complete digitization of Egypt's national food ration system
2. **Food Convoy Routing System** — AI-powered routing that uses Tamween data as input to direct government food convoys to the most underserved regions

The data flow from System 1 → System 2 is the proof of concept for a broader **unified national government data platform** — a blueprint for Egypt's Vision 2030 digital transformation.

---

## System Architecture

```
+-------------------------------------------------------+
|   Citizens / Outlet Operators / Ministry Officials    |
+-------------------------------------------------------+
                          |
         +----------------+----------------+
         |                                 |
   React.js Web                    React Native
   Port 5173 / 5174                 Mobile App
         |                                 |
         +-----------+---------------------+
                     |
         +-----------v-----------+
         |   Node.js + Express 5  |
         |   JWT Auth + RBAC      |
         |   Port 3000            |
         +-----------+-----------+
                     |
         +-----------v-----------+
         |  PostgreSQL (port 5433)|
         |  via Prisma ORM        |
         +-----------+-----------+
                     |
         +-----------v-----------+
         | Apache Airflow + Spark |
         | Deprivation Score Engine|
         | Regional Ranking Output|
         +-----------+-----------+
                     |
         +-----------v-----------+
         |   Docker + Azure       |
         +-----------------------+
```

---

## Key Features

| Feature | Description |
|---|---|
| QR Code Authentication | Each citizen has a unique QR code — eliminates ration card forgery |
| OTP-Secured Restock | Ministry sends OTP to outlet to confirm stock delivery |
| Multiple Payment Methods | Ration credit, cash, or bank card |
| Home Delivery System | Citizens request delivery; outlets confirm dispatch |
| AI Regional Ranking | Multi-factor deprivation score ranks governorates by food need |
| Food Convoy Routing | Routes government convoys to most underserved regions |
| Government Dashboard | Real-time KPIs, low-stock alerts, outlet map |
| Mobile App | iOS/Android for citizens and outlet operators |
| Physical Tamween Card | For elderly/non-digital citizens — QR-integrated |
| Big Data Pipeline | Airflow DAG + Spark job — daily analytics sync |

---

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React.js 18, Vite, Tailwind CSS |
| Mobile | React Native, Expo |
| Backend | Node.js, Express 5, Prisma 7 |
| Database | PostgreSQL 15, Redis |
| Real-Time | Socket.io |
| Big Data | Apache Airflow 2.7, Apache Spark 3.x (PySpark) |
| Auth | JWT, bcrypt, QR Code, OTP |
| Maps | Leaflet.js, React-Leaflet |
| DevOps | Docker, docker-compose, Microsoft Azure |

---

## Project Structure

```
TEAM/
├── digital-tamween/
│   ├── backend/                  # Node.js + Express API (port 3000)
│   ├── frontend-web/             # Citizen & Outlet Portal (port 5173)
│   ├── mobile-app/               # React Native iOS/Android app
│   ├── big-data/                 # Airflow DAGs + Spark jobs
│   └── docker-compose.yml
├── food-security/
│   └── backend/                  # Food Convoy Routing API
└── gov-portal/
    └── frontend-web/             # Ministry Officials Portal (port 5174)
```

---

## Running the Project

> Open **4 separate terminal windows** and run each step in its own terminal.  
> Prerequisites: **Docker Desktop must be open and running** before anything else.

---

### Terminal 1 — Docker Services (PostgreSQL, Redis, pgAdmin, Airflow, Spark)

```bash
cd C:\Users\Admin\Desktop\TEAM\digital-tamween
docker-compose up -d
```

Wait ~30 seconds for all containers to start, then verify:
```bash
docker ps
```
You should see: `tamween_postgres`, `tamween_redis`, `tamween_pgadmin`, `tamween_airflow`, `tamween_spark`

---

### Terminal 2 — Backend API

```bash
cd C:\Users\Admin\Desktop\TEAM\digital-tamween\backend
npm run dev
```

Running on → http://localhost:3000

---

### Terminal 3 — Tamween Web Portal (Citizen & Outlet)

```bash
cd C:\Users\Admin\Desktop\TEAM\digital-tamween\frontend-web
npm run dev
```

Running on → http://localhost:5173

---

### Terminal 4 — Government Portal

```bash
cd C:\Users\Admin\Desktop\TEAM\gov-portal\frontend-web
npm run dev
```

Running on → http://localhost:5174

---

### Terminal 5 (Optional) — Mobile App

```bash
cd C:\Users\Admin\Desktop\TEAM\digital-tamween\mobile-app
npx expo start
```

Scan the QR code with Expo Go app on your phone.

---

### All URLs After Startup

| Service | URL |
|---|---|
| Tamween Web (Citizen / Outlet) | http://localhost:5173 |
| Government Portal | http://localhost:5174 |
| Backend API | http://localhost:3000 |
| pgAdmin | http://localhost:5050 |
| Apache Airflow | http://localhost:8085 |
| Apache Spark UI | http://localhost:9090 |

---

### If Port 3000 is Already in Use

```bash
npx kill-port 3000
```

Then re-run Terminal 2.

---

## Service URLs

| Service | URL | Credentials |
|---|---|---|
| Tamween Web | http://localhost:5173 | See test accounts below |
| Gov Portal | http://localhost:5174 | admin@tamween.gov.eg / admin123 |
| Backend API | http://localhost:3000 | — |
| pgAdmin | http://localhost:5050 | — |
| Airflow | http://localhost:8085 | admin / admin |
| Spark UI | http://localhost:9090 | — |

---

## Test Accounts

### Admin Accounts (password: `admin123`)

| Email | Role |
|---|---|
| admin@tamween.gov.eg | Ministry Official |
| admin2@tamween.gov.eg | Ministry Official |
| admin3@tamween.gov.eg | Ministry Official |
| admin4@tamween.gov.eg | Ministry Official |

### Outlet Operators (password: `owner123`)

| Email | Outlet |
|---|---|
| outlet1@tamween.gov.eg | Outlet 1 |
| outlet2@tamween.gov.eg | Outlet 2 |
| outlet3@tamween.gov.eg | Outlet 3 |
| outlet4@tamween.gov.eg | Outlet 4 |
| outlet5@tamween.gov.eg | Outlet 5 |
| outlet6@tamween.gov.eg | Outlet 6 |
| outlet7@tamween.gov.eg | Outlet 7 |
| outlet8@tamween.gov.eg | Outlet 8 |

### Citizens — login with National ID (password: `user123`)

> **Bank Card PIN for all citizens: `000000`**

| Name | National ID | Ration Card PIN |
|---|---|---|
| Ali Hassan Mohamed | 29901011234567 | 1234 |
| Fatima Ahmed Ali | 30005152345678 | 5678 |
| Mohamed Saeed Ibrahim | 28807203456789 | 9021 |
| Nora Saeed Omar | 30003102345670 | 2345 |
| Karim Tarek Hassan | 29506075678901 | 6789 |
| Hoda Reda Mohamed | 29811209012345 | 3456 |
| Omar Khaled Abdullah | 30108123456781 | 7890 |
| Sara Mostafa Ahmed | 29702285432109 | 4321 |
| Yousef Essam Ali | 30205176789012 | 8765 |

---

## AI Deprivation Scoring Formula

```
Score = 0.30*(Income) + 0.20*(Housing) + 0.20*(FamilySize)
      + 0.15*(ConsumptionPattern) + 0.15*(GeographicIndex)
```

Score range: 0–100. Higher score = more deprived = higher convoy routing priority.

---

## Videos

| Video | Link |
|---|---|
| Demo Video | [Watch Demo](https://drive.google.com/file/d/1ikS-CMicyEOzhGtAnU8E2LRzjjwNq3Wh/view?usp=sharing) |
| Promo Video (Arabic) | [Watch Promo AR](https://drive.google.com/file/d/1ROmORjmpxytbbiyNEM5qGIpa2Bwu-MLa/view?usp=sharing) |
| Promo Video (English) | [Watch Promo EN](https://drive.google.com/file/d/18UBdIcYzebKc5sWFS74H29pzkMYkhOkz/view?usp=sharing) |

---

## Team

**Al-Rowad Al-Raqmiyoun (DiGiLiANS)** — Nano Degree Program  
Egyptian Military Academy × Ministry of Communications and Information Technology (MCIT)

---

## License

This project was developed as a capstone project for the DiGiLiANS Nano Degree Program. All rights reserved.
