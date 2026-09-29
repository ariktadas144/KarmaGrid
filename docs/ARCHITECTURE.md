# KarmaGrid Architecture Document

## 1. OVERVIEW

KarmaGrid is a volunteer and organization management platform designed to handle volunteer data ingestion, authentication, and task matching. It is built as a RESTful API backend that prioritizes robustness, testability, and secure data handling.

**Current Tech Stack:**
- **Runtime**: Node.js (v18+)
- **Framework**: Express 5.2.1
- **ORM / Database**: Prisma 5.22.0 / PostgreSQL
- **Validation**: Zod 4.6.5
- **Logging**: Pino 10.3.1 (with pino-http 11.0.0)
- **Security**: bcrypt 6.0.0, jsonwebtoken 9.0.3, cookie-parser 1.4.7
- **Testing**: Native `node:test` and `node:assert`

**Implementation Status:**
KarmaGrid is currently in active development. As of this snapshot, Phase 1 (Authentication & Foundation) is fully implemented and tested. Future phases, such as Phase 2 (Core Features) and Phase 3 (Batch Processing Pipeline), have architectural placeholders but are not yet functional.

---

## 2. ARCHITECTURE

The application uses a strict layered architecture pattern to ensure separation of concerns:
- **Routes (`src/routes`)**: Maps HTTP methods and endpoints to specific controller functions and applies route-level middleware.
- **Controllers (`src/controllers`)**: Handles HTTP requests and responses. It parses input (e.g., extracting cookies or bodies), delegates business logic to the service layer, and formats the outgoing HTTP response.
- **Services (`src/services`)**: Contains the core business logic. For example, `auth.service.js` handles password comparison, token generation, and coordination of database operations.
- **Repositories (`src/repositories`)**: Abstracts the Prisma ORM layer. Services never call Prisma directly; instead, they call repository functions like `refreshTokenRepo.findByTokenHash(tokenHash)`.

**Request Flow Example:** `POST /api/auth/volunteer/signin`
1. The request hits the router in `routes/auth.routes.js`.
2. It passes through the `validate(signinSchema)` middleware (`middleware/validate.js`) which uses Zod to ensure the body contains a valid email and password.
3. The request reaches `authController.volSignin` (`controllers/auth.controller.js`), which extracts the credentials and calls `authService.signin()`.
4. In `services/auth.service.js`, the `signin()` function looks up the user by calling `volunteerRepo.findByEmail()`.
5. The `volunteerRepo` translates this into a Prisma query (`prisma.volunteer.findUnique()`) and hits the PostgreSQL database.
6. The service compares the password using `bcrypt`, generates tokens, and calls `refreshTokenRepo.create()`.
7. The service returns the tokens to the controller, which sets them as `httpOnly` cookies and responds with `200 OK`.

**Why this layering?**
The primary motivation for this layered design is testability. By separating the repository layer, we can easily mock database calls in unit tests without standing up a live database. The tradeoff is increased boilerplate and indirection—what could be a single 50-line Express route becomes spread across four files.

---

## 3. AUTHENTICATION & AUTHORIZATION

**Dual-JWT-Secret Design:**
KarmaGrid uses two distinct JWT secrets: `JWT_ORG_SECRET` and `JWT_VOL_SECRET`. Instead of using a single secret and trusting a `role` claim inside the token payload, tokens are cryptographically bound to their role via the secret. This limits blast radius: a compromised organization secret cannot be used to forge volunteer tokens, and vice versa.

**Access vs. Refresh Tokens:**
The system issues a short-lived access token (15m) and a long-lived refresh token (7d). This limits the exposure window if an access token is intercepted, while still providing a seamless UX via the long-lived refresh token. 

**Refresh Token Rotation & Hashing:**
When a refresh token is used, `auth.service.js` looks up its hash in the database. On success, it calls `refreshTokenRepo.revoke(oldHash)` to invalidate the old token and `refreshTokenRepo.create(newHash)` to issue a new one. Storing only the SHA-256 hash (via the `hashToken()` utility) ensures that if the database is leaked, the attacker gains no usable refresh tokens.

**Middleware Split (verifyToken vs requireRole):**
Authentication and authorization are separated into two distinct middlewares. 
- `verifyToken(role)` ensures the user is who they claim to be by verifying the JWT against the specified role's secret.
- `requireRole(...roles)` ensures the authenticated user has permission to access the route.
*Note on Redundancy:* Because `verifyToken` requires the route to specify which secret to use (e.g., `verifyToken('ORG')`), it implicitly filters by role. Therefore, a subsequent `requireRole('ORG')` is currently redundant in this codebase, but the split is maintained to honor the conceptual boundary between identity verification and permission checking.

---

## 4. DATA MODEL

The database schema (`prisma/schema.prisma`) currently defines the following models:

- **Organization**: Represents charities or groups. Stores `email`, `password`, and links to multiple `Tasks`.
- **Volunteer**: Represents individual users. Stores `email`, `password`, and links to `Reviews` they have left.
- **Task**: An activity created by an `Organization`.
- **Review**: A rating and comment left by a `Volunteer` on a specific `Task`.
- **IngestionRun**: Tracks the state (`PENDING`, `RUNNING`, `COMPLETED`, etc.) of CSV batch imports, storing `checkpointOffset` and `sourceHash` to guarantee idempotency.
- **RefreshToken**: Stores active and revoked refresh sessions.

**Why RefreshToken is a separate table:**
Rather than adding a `refreshToken` column to the Volunteer or Organization tables, `RefreshToken` is its own model linked by `userId`. This architectural choice allows a single user to have multiple concurrent active sessions (e.g., logged in on both a phone and a laptop) and enables selective revocation of specific sessions.

---

## 5. ERROR HANDLING

Errors are caught by route wrappers and forwarded to a centralized error handler (`middleware/errorHandler.js`). The handler maps known errors (like `ZodError` to `400 Validation Error`, or `err.status = 401` to `401 Unauthorized`) into clean JSON responses, masking stack traces in production. Only truly unexpected errors fall through to the `500 Internal Server Error` block.

**Debugging Case Study:**
During development, a bug was found where custom client errors (e.g., missing parameters) were being instantiated with `err.status = 400` and thrown, but were resulting in `500 Internal Server Error` responses. The root cause was that `errorHandler.js` had explicit branches for Zod validation errors and `401/403/404` statuses, but no generic fallback for other `4xx` errors. A catch-all branch (`if (err.status >= 400 && err.status < 500)`) was added right before the 500 fallback, allowing custom `400` errors to propagate their messages correctly to the client.

---

## 6. TESTING STRATEGY

KarmaGrid relies exclusively on the native `node:test` runner and `node:assert/strict`.

- **Unit Tests (`tests/unit`)**: These tests validate service and middleware logic in pure isolation. We use `t.mock.method` to intercept calls to the repository layer, `bcrypt`, and `jwt`. No live database is used, making these tests extremely fast and preventing side effects.
- **Integration Tests (`tests/integration`)**: These tests spin up the real Express application in-memory (using `app.listen(0)` to bind to an ephemeral port) and issue real HTTP requests using the native `fetch` API. They test the end-to-end wiring of routes, middleware, controllers, and services.

---

## 7. KEY DESIGN DECISIONS & TRADEOFFS

| Decision | Why | Tradeoff / Alternative |
| :--- | :--- | :--- |
| **PostgreSQL over SQLite** | Required for concurrent batch processing and enterprise data integrity. | Heavier footprint, requires a running daemon unlike embedded SQLite. |
| **Prisma ORM over raw SQL** | Type safety and rapid schema migrations. | Less control over exact query execution plans; slight overhead. |
| **httpOnly cookies over headers** | Prevents XSS attacks from stealing JWTs out of localStorage. | Requires careful CORS configuration and CSRF mitigations. |
| **Layered architecture over flat files** | Enables repository mocking in unit tests and keeps controllers thin. | Requires navigating 4-5 files to understand a single endpoint's flow. |

---

## 8. HOW TO EXPLAIN THIS PROJECT IN AN INTERVIEW

KarmaGrid is a scalable backend designed with a focus on robust testing and secure state management. The strongest elements of the current architecture are its strict layering—which enables pure unit testing of business logic without a live database—and its robust authentication system, which features hashed refresh token rotation and dual-secret JWT validation. While the schema includes foundations for high-throughput batch ingestion and idempotency tracking, it is important to note that the actual batch processing pipeline is structurally mapped but not yet fully implemented.
