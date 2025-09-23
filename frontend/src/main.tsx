import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './styles/index.css'
import App from './App.tsx'
import SearchPage from './pages/SearchPage'

const router = createBrowserRouter([
  { path: '/', element: <App /> },
  { path: '/search', element: <SearchPage /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
