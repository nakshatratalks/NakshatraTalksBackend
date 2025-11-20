# NakshatraTalks

A modern full-stack application built with Next.js, Express.js, TypeScript, and Supabase.

## Tech Stack

### Frontend
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Auth/Database:** Supabase Client

### Backend
- **Framework:** Express.js
- **Language:** TypeScript
- **Runtime:** Node.js
- **Database/Auth:** Supabase
- **Documentation:** Swagger UI (OpenAPI 3.0)

## Project Structure

```
nakshatraTalks/
├── client/                 # Next.js frontend application
│   ├── app/               # Next.js App Router
│   │   ├── globals.css    # Global styles with Tailwind
│   │   ├── layout.tsx     # Root layout
│   │   └── page.tsx       # Home page
│   ├── lib/               # Utility functions and configurations
│   │   └── supabaseClient.ts  # Supabase client setup
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   └── next.config.ts
├── server/                # Express.js backend
│   ├── src/
│   │   ├── config/
│   │   │   └── swagger.ts     # Swagger/OpenAPI configuration
│   │   └── server.ts          # Express server entry point
│   ├── package.json
│   ├── tsconfig.json
│   └── nodemon.json
├── package.json           # Root package.json with monorepo scripts
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Supabase account (for database and authentication)

### Installation

#### 1. Clone and Install Dependencies

```bash
# Install root dependencies
npm install

# Install dependencies for both client and server
npm run install:all
```

Alternatively, install manually:

```bash
# Install root dependencies
npm install

# Install client dependencies
cd client
npm install

# Install server dependencies
cd ../server
npm install
```

#### 2. Set Up Environment Variables

**Server (.env in /server directory):**

```bash
cd server
cp .env.example .env
```

Edit `server/.env` with your values:

```env
PORT=4000
NODE_ENV=development

SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

CLIENT_URL=http://localhost:3000
```

**Client (.env.local in /client directory):**

```bash
cd client
cp .env.example .env.local
```

Edit `client/.env.local` with your values:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_API_URL=http://localhost:4000
```

#### 3. Get Supabase Credentials

1. Go to [https://supabase.com](https://supabase.com)
2. Create a new project or use an existing one
3. Go to Project Settings > API
4. Copy your:
   - Project URL (SUPABASE_URL)
   - Anon/Public Key (SUPABASE_ANON_KEY)
   - Service Role Key (SUPABASE_SERVICE_ROLE_KEY)

### Running the Application

#### Development Mode (Both Client and Server)

Run both the client and server concurrently:

```bash
# From the root directory
npm run dev
```

This will start:
- **Frontend:** http://localhost:3000
- **Backend:** http://localhost:4000
- **API Documentation:** http://localhost:4000/api-docs

#### Run Client or Server Individually

```bash
# Run only the frontend
npm run dev:client

# Run only the backend
npm run dev:server
```

Or manually:

```bash
# Frontend
cd client
npm run dev

# Backend (in a new terminal)
cd server
npm run dev
```

### Building for Production

```bash
# Build both client and server
npm run build

# Build individually
npm run build:client
npm run build:server
```

### Running in Production

```bash
# Start both client and server
npm run start

# Start individually
npm run start:client
npm run start:server
```

## API Documentation

Once the server is running, access the interactive API documentation at:

- Swagger UI: http://localhost:4000/api-docs
- OpenAPI JSON: http://localhost:4000/api-docs.json

### Available Endpoints

#### Health Check

**GET** `/health`

Check if the API server is running.

**Response:**
```json
{
  "status": "ok",
  "message": "NakshatraTalks API is running",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 123.456
}
```

## Development Workflow

### Backend Development

The backend uses nodemon for hot-reloading. Any changes to TypeScript files in the `server/src` directory will automatically restart the server.

```bash
cd server
npm run dev
```

### Frontend Development

Next.js provides fast refresh for instant feedback on changes.

```bash
cd client
npm run dev
```

### Type Checking

```bash
# Check types in the server
cd server
npm run type-check

# Next.js checks types automatically during build
cd client
npm run build
```

## Project Features

- **Monorepo Structure:** Organized client and server in separate directories
- **TypeScript:** Full type safety across frontend and backend
- **API Documentation:** Auto-generated Swagger/OpenAPI documentation
- **Modern React:** Using Next.js 15 with App Router
- **Tailwind CSS:** Utility-first styling with dark mode support
- **Supabase Integration:** Ready for authentication and database operations
- **Development Tools:** Hot-reloading, type checking, and linting

## Next Steps

1. Set up your Supabase database schema
2. Create authentication flows in the frontend
3. Add protected API routes in the backend
4. Implement business logic and features
5. Configure deployment (Vercel for frontend, Railway/Render for backend)

## Scripts Reference

### Root Level

- `npm run dev` - Run both client and server in development mode
- `npm run build` - Build both client and server for production
- `npm run start` - Start both client and server in production mode
- `npm run install:all` - Install all dependencies

### Client Scripts (from /client)

- `npm run dev` - Start Next.js development server (port 3000)
- `npm run build` - Build Next.js for production
- `npm run start` - Start Next.js production server
- `npm run lint` - Run ESLint

### Server Scripts (from /server)

- `npm run dev` - Start Express server with nodemon (port 4000)
- `npm run build` - Compile TypeScript to JavaScript
- `npm run start` - Run compiled server
- `npm run type-check` - Check TypeScript types without emitting

## Troubleshooting

**Port already in use:**
- Frontend (3000): Change port in package.json dev script: `next dev -p 3001`
- Backend (4000): Change PORT in server/.env

**Module not found errors:**
- Run `npm run install:all` from the root directory
- Clear node_modules: `rm -rf node_modules client/node_modules server/node_modules`
- Reinstall: `npm run install:all`

**Supabase connection errors:**
- Verify environment variables are set correctly
- Check that Supabase project is active
- Ensure API keys are copied correctly (no extra spaces)

## License

ISC
