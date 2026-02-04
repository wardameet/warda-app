# 🌹 Warda — AI Companion for Elderly Care

**"You're Never Alone"**

Warda is an AI-powered companion system designed specifically for elderly users in care homes and at home. Built by **Tweed Wellness Ltd**, Warda provides personalised, culturally-aware conversations, family connectivity, health monitoring, and proactive wellbeing support.

---

## 🌐 Live Platform

| Service | URL | Port |
|---------|-----|------|
| 🌐 Landing Page | [meetwarda.com](https://meetwarda.com) | 3005 |
| 📱 Tablet App | [app.meetwarda.com](https://app.meetwarda.com) | 3002 |
| 👩‍💼 Staff Dashboard | [staff.meetwarda.com](https://staff.meetwarda.com) | 3003 |
| 👨‍👩‍👧 Family App | [family.meetwarda.com](https://family.meetwarda.com) | 3006 |
| 🏥 GP Portal | [gp.meetwarda.com](https://gp.meetwarda.com) | 3004 |
| 🔌 API Server | [api.meetwarda.com](https://api.meetwarda.com) | 3001 |

## 🏗️ Tech Stack

- **Backend:** Node.js + Express.js + Prisma ORM
- **Frontend:** React + TypeScript + Tailwind CSS
- **Database:** PostgreSQL (AWS RDS) — 17 models
- **Auth:** AWS Cognito (JWT) + PIN for elderly
- **AI:** Anthropic Claude (personalised conversations)
- **Storage:** AWS S3 (photos, media)
- **Cache:** AWS ElastiCache (Valkey)
- **Hosting:** AWS EC2 (t3.small) + Nginx + Let's Encrypt

## 🔌 API: 104 endpoints across 23 route files

## 💰 Pricing: B2B £25-35/resident/month | B2C £19.99-39.99/month

## 📦 Related Repos

| Repo | Description |
|------|-------------|
| [warda-staff](https://github.com/wardameet/warda-staff) | Staff dashboard |
| [warda-family](https://github.com/wardameet/warda-family) | Family app |
| [warda-landing](https://github.com/wardameet/warda-landing) | Landing page |

## 🔒 Security

HTTPS everywhere, AWS Cognito auth, RBAC, GDPR compliant, NHS aligned, encrypted at rest.

---

*Tweed Wellness Ltd © 2026 — Built with ❤️ for the elderly*
