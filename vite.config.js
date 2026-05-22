import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Set REPO_NAME to your GitHub repo name (e.g. "prism")
// Leave as "/" if deploying to a root domain (username.github.io)
const REPO_NAME = 'prism'

export default defineConfig({
  plugins: [react()],
  base: `/${REPO_NAME}/`,
})
