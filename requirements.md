Mini Task Tracker
Overview
Build a Task Tracker Web App where users can create, view, and manage tasks.
The goal is to demonstrate your understanding of backend APIs (Node.js, MongoDB, Redis).
Requirements
Backend (Node.js + Express + Mongoose + Redis)
Create a REST API with the following features:
User & Task Models
User: name, email, password (hashed), createdAt
Task: title, description, status (pending | completed), dueDate, owner (User ref), createdAt
Endpoints
POST /api/auth/signup → Create new user
POST /api/auth/login → Authenticate user (JWT-based)
GET /api/tasks → List tasks for the logged-in user
POST /api/tasks → Create a new task
PUT /api/tasks/:id → Update a task
DELETE /api/tasks/:id → Delete a task
Caching with Redis
Cache the result of GET /api/tasks for each user.
When a user creates, updates, or deletes a task, invalidate the cache.
MongoDB with Mongoose
Use Mongoose models and schema validation.
Ensure proper indexing on owner and status.
Testing
Backend Tests
Use Jest
Write unit tests and integration tests
Mock Redis and MongoDB using libraries like redis-mock and mongodb-memory-server.
Expected Coverage
Aim for ~70%+ coverage on backend code.
Include a coverage report (npm run test:coverage).
Bonus (Optional)
Implement task filtering (by status or due date).
Dockerize (API + MongoDB + Redis via docker-compose).
What We’re Evaluating
Code structure & readability
Proper use of async/await and error handling
Mongoose schema design
Redis caching strategy
Security (JWT handling, password hashing)
Developer ergonomics (clear README, setup instructions)
Submission
Share a public GitHub repository containing:
codebase
README.md with setup steps and environment variable info
Include sample .env.example
Ensure the repository is public (private repository will lead to disqualification)
