# NUST NEXUS

A comprehensive student resource platform built with Vite and Supabase. NUST NEXUS provides a centralized hub for students to share resources, ask questions, collaborate on projects, and interact with the academic community, while providing an extensive administrative dashboard for platform management.

## 🚀 Key Features

### For Students
- **Resource Hub**: Upload and download assignments, lab reports, quizzes, lecture PPTs, and semester projects.
- **Points & Gamification System**: Earn points by uploading resources, answering questions, or fulfilling assessment requests. Spend points to download premium content (e.g., semester projects).
- **Q&A Forum**: Ask academic questions, provide answers, and upvote the best responses. Accepted answers grant bonus points.
- **Project Idea Room**: Share and collaborate on project ideas. Features a smart similarity checker to prevent duplicate submissions.
- **Teacher Ratings**: Browse and review teacher profiles and courses.
- **Assessment Requests**: Request specific materials or assessments from peers.

### For Administrators
- **Extensive Admin Dashboard**: Manage users, teachers, courses, and platform activity.
- **Content Moderation**: Review pending uploads, feedback, assessment requests, and project ideas.
- **User Management**: Analyze user behavior, track login history, process delete requests, ban users, and manually award points.
- **Notifications**: Broadcast alerts and notifications to users.

## 🏗 Architecture

The platform follows a modern, serverless architecture using a Single Page Application (SPA) frontend and a Backend-as-a-Service (BaaS).

- **Frontend**: Vite (Vanilla JavaScript + CSS). Uses `animejs` and `gsap` for rich, dynamic animations.
- **Backend & Database**: Supabase (PostgreSQL).
- **Authentication**: Supabase Auth (JWT-based). Restricts registration to valid university email domains (e.g., `@nust.edu.pk`, `@seecs.edu.pk`).
- **Storage**: Supabase Storage (`uploads` bucket) is used for storing file binaries directly from the client.
- **Security**: 
  - PostgreSQL Row Level Security (RLS) protects data access.
  - Client-side SHA-256 file hashing for upload verification.
  - Auto-logout on inactivity and absolute session timeouts.

## 🛠 Quick Start (Local Development)

1. Clone the repository and navigate to the project directory.
2. Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Configure your `.env` variables:
   - `VITE_SUPABASE_URL`: Your Supabase project URL.
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: Your Supabase publishable key (from Project Settings → API Keys).
   - `VITE_ADMIN_EMAIL`: The email address that should be granted administrative privileges.
4. Install dependencies:
   ```bash
   npm install
   ```
5. Apply the database SQL schema as described in **`docs/IMPLEMENTATION_PLAN.md`**.
6. Start the development server:
   ```bash
   npm run dev
   ```

## 📜 Available Scripts

| Command | Purpose |
|--------|---------|
| `npm run dev` | Starts the Vite development server |
| `npm run build` | Builds the app for production |
| `npm run preview` | Previews the production build locally |
| `npm run test:login` | Runs smoke-tests for authentication (`TEST_EMAIL` / `TEST_PASSWORD` required in `.env`) |

## 📂 Project Structure

- `src/pages/`: Contains the logic and rendering for all individual views (e.g., dashboard, upload, idea-room, admin modules).
- `src/components/`: Reusable UI components.
- `src/utils/`: Helper utilities for Auth, Storage, Realtime subscriptions, and caching.
- `src/styles/`: Vanilla CSS files including a comprehensive design system and page-specific styles.
- `supabase/`: Supabase configuration and SQL migration files.
- `docs/`: Project documentation, including the detailed Implementation Plan.

---
*Built for the NUST community.*
