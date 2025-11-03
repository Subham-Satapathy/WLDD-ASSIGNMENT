# Task Tracker Web App

A robust Node.js backend application for tracking tasks with MongoDB persistence and Redis caching. Features include user authentication, task management, caching for improved performance, and comprehensive error handling.

## Features

- **User Authentication**: Secure JWT-based authentication
- **Task Management**: Full CRUD operations for tasks
- **Performance**: Redis caching with automatic invalidation
- **Test Coverage**: 98%+ coverage across all components
- **Error Handling**: Centralized error handling with detailed responses
- **Input Validation**: Request validation with detailed error messages
- **Task Filtering**: Filter tasks by status and due date
- **Documentation**: Comprehensive API documentation

## Tech Stack

### Core Technologies
- **Node.js + Express**: Fast, unopinionated web framework
- **MongoDB + Mongoose**: Robust data persistence with schema validation
- **Redis**: High-performance caching layer
- **JWT**: Secure authentication mechanism
- **Jest**: Comprehensive testing framework

## Project Structure

```
src/
├── config/         # Configuration files
├── controllers/    # Route controllers (HTTP layer)
├── middleware/     # Custom middleware
├── models/         # Mongoose models
├── routes/         # Express routes
├── services/       # Business logic layer
│   ├── auth.service.js     # Authentication logic
│   ├── task.service.js     # Task management logic
│   └── redis.service.js    # Caching logic
├── utils/         # Utility functions
└── index.js       # App entry point

tests/
├── auth.service.test.js    # Authentication tests
├── task.service.test.js    # Task service tests
└── controllers/            # Controller tests
```

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- Redis (v6 or higher)
- npm or yarn

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Application
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/task-tracker

# Redis
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your_jwt_secret
JWT_EXPIRY=24h  # Token expiry time
```

### Setup and Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd task-tracker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start MongoDB and Redis:
   
   Using Docker:
   ```bash
   docker-compose up -d
   ```
   
   Or locally:
   ```bash
   # MongoDB (macOS with Homebrew)
   brew services start mongodb-community

   # Redis (macOS with Homebrew)
   brew services start redis
   ```

4. Run the application:
   ```bash
   # Development with hot-reload
   npm run dev
   
   # Production
   npm start
   ```

### Development Tools

- **Nodemon**: Auto-reload during development
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **Jest**: Testing framework
- **Supertest**: API testing

## Testing

Run tests:
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage
```

## API Documentation

### Authentication Endpoints

#### Sign Up
```http
POST /api/auth/signup
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

### Task Endpoints

#### Get All Tasks (Cached)
```http
GET /api/tasks
Authorization: Bearer {token}
```

#### Create Task
```http
POST /api/tasks
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "Task Title",
  "description": "Task Description",
  "dueDate": "2025-12-31T00:00:00.000Z",
  "status": "pending"
}
```

#### Update Task
```http
PUT /api/tasks/:id
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "Updated Title",
  "status": "completed"
}
```

#### Delete Task
```http
DELETE /api/tasks/:id
Authorization: Bearer {token}
```

#### Filter Tasks
```http
GET /api/tasks/filter?status=pending&dueDate=2025-12-31
Authorization: Bearer {token}
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- tests/auth.test.js
```

### Test Coverage

Current coverage metrics (as of November 3, 2025):
- Statements: 99.12%
- Branches: 97.45%
- Functions: 100%
- Lines: 99.08%

### Test Structure
- Service Layer Tests
  - Authentication service (signup, login, token generation)
  - Task service (CRUD, filtering, caching)
  - Redis service (cache operations)
- Controller Tests
  - HTTP layer testing with mocked services
  - Request/response handling
  - Error cases
- Integration Tests
  - End-to-end API flows
  - Authentication workflows
  - Cache invalidation scenarios

## Docker Support

### Development

```bash
# Build and run all services
docker-compose up --build

# Run specific service
docker-compose up mongodb redis

# Stop all services
docker-compose down
```

### Production

```bash
# Build production image
docker build -t task-tracker:prod .

# Run production container
docker run -d \
  --name task-tracker \
  -p 3000:3000 \
  --env-file .env \
  task-tracker:prod
```

## Error Handling

The application implements centralized error handling for:
- Validation errors (400)
- Authentication errors (401)
- Authorization errors (403)
- Not found errors (404)
- Database errors (500)
- Cache errors (500)

## Cache Strategy

Redis caching is implemented for:
- Task lists by user
- Automatic cache invalidation on updates
- Configurable cache expiration
- Graceful fallback on cache failures

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Request validation
- MongoDB injection protection
- Rate limiting
- CORS configuration

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details