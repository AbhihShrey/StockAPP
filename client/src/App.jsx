import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { NavigationProgress } from './components/NavigationProgress'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Dashboard } from './pages/Dashboard'
import { Markets } from './pages/Markets'
import { News } from './pages/News'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { Sectors } from './pages/Sectors'
import { Strategies } from './pages/Strategies'
import { TechnicalAnalysis } from './pages/TechnicalAnalysis'
import { Welcome } from './pages/Welcome'

function RootRedirect() {
  const { isAuthenticated } = useAuth()
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return <Navigate to="/welcome" replace />
}

function AppRoutes() {
  return (
    <>
      <NavigationProgress />
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/welcome" element={<Welcome redirectIfAuthenticated={false} />} />
        <Route path="/products" element={<PlaceholderPage />} />
        <Route path="/solutions" element={<PlaceholderPage />} />
        <Route path="/enterprise" element={<PlaceholderPage />} />
        <Route path="/pricing" element={<PlaceholderPage />} />
        <Route path="/contact" element={<PlaceholderPage />} />
        <Route path="/app" element={<PlaceholderPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="markets" element={<Markets />} />
            <Route path="news" element={<News />} />
            <Route path="charts" element={<TechnicalAnalysis />} />
            <Route path="analysis/:symbol" element={<TechnicalAnalysis />} />
            <Route path="sectors" element={<Sectors />} />
            <Route path="strategies" element={<Strategies />} />
            <Route path="gainers-losers" element={<Navigate to="/markets" replace />} />
            <Route path="technical-analysis" element={<Navigate to="/charts" replace />} />
            <Route path="sector-quadrant" element={<Navigate to="/sectors" replace />} />
          </Route>
        </Route>
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
