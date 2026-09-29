# KarmaGrid

KarmaGrid is a volunteer and organization management platform built to handle large-scale volunteer data ingestion, authentication, and task matching.

## Architecture

The system is built as a modular Node.js API with Express and Prisma (PostgreSQL).

Key design decisions:
- **Authentication**: Stateless JWT-based authentication using short-lived access tokens and long-lived refresh tokens. Refresh tokens are hashed using SHA-256 before database storage to mitigate the impact of potential data breaches. Role-based access control (RBAC) is enforced at the route level via middleware.
- **Batch Processing Pipeline**: A chunk-based architecture designed for high-throughput data ingestion (e.g., CSV imports). The pipeline implements constraint-based deduplication and run-hash tracking to guarantee idempotency across retries.
- **Transactional Integrity**: Critical operations (like organization/volunteer registration or batch ingestion) utilize database transactions, guaranteeing atomic updates across related entity tables.
- **Centralized Error Handling**: A global error handler catches and formats API responses, integrated closely with Zod for robust request validation and Pino for structured, high-performance logging.

## Local Development

### Prerequisites
- Node.js (v18+)
- PostgreSQL
- npm

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   Create a `.env` file in the root directory based on `.env.example`. Make sure to provide a valid database connection string and secure JWT secrets.
   ```
   DATABASE_URL="postgresql://user:pass@localhost:5432/karmagrid"
   JWT_ORG_SECRET="super_secret_org"
   JWT_VOL_SECRET="super_secret_vol"
   ```

3. Initialize the database:
   ```bash
   npx prisma migrate dev
   ```

4. Run the application:
   ```bash
   # Development mode with auto-reload
   npm run dev

   # Production mode
   npm start
   ```

### Testing

The project uses the native `node:test` runner.

Run the test suite:
```bash
npm test
```
