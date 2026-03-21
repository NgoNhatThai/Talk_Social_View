# Talk Social - Premium Chat Frontend

A high-performance, aesthetically pleasing Vue 3 + TypeScript boilerplate for the Talk Social application, integrated with a local backend.

## 🚀 Features

- **Vue 3 + Vite**: Lightning fast development and production builds.
- **Modern Design**: Premium dark mode, glassmorphism, and smooth animations using Vanilla CSS.
- **Authentication**: Pre-built Login and Register flows with JWT cookie persistence.
- **Pinia**: Centralized state management for user sessions and app data.
- **Axios Integration**: Pre-configured for backend at `http://localhost:3030`.

## 📁 Project Structure

- `src/api/`: Axios instance and API service definitions.
- `src/assets/styles/`: Global CSS variables and utility classes.
- `src/router/`: Application routing logic.
- `src/store/`: Pinia state management (Auth, App).
- `src/views/`: Page components (Home, Login, Register, About).

## 🛠️ Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Development Server**:
   ```bash
   npm run dev
   ```

3. **Build for Production**:
   ```bash
   npm run build
   ```

## 🔌 Backend Integration

The application is pre-configured to communicate with your backend running at `http://localhost:3030`. You can change this in `src/api/index.ts`.
