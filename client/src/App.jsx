import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Layout } from './components/Layout'
import { NavigationProgress } from './components/NavigationProgress'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AlertProvider } from './context/AlertContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { getDefaultLanding } from './lib/prefs'
import { Alerts } from './pages/Alerts'
import { Dashboard } from './pages/Dashboard'
import { InsiderActivity } from './pages/InsiderActivity'
import { Markets } from './pages/Markets'
import { News } from './pages/News'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { Portfolio } from './pages/Portfolio'
import { Sectors } from './pages/Sectors'
import { Strategies } from './pages/Strategies'
import { TechnicalAnalysis } from './pages/TechnicalAnalysis'
import { Watchlist } from './pages/Watchlist'
import { ResetPassword } from './pages/ResetPassword'
import { Settings } from './pages/Settings'
import { VerifyEmail } from './pages/VerifyEmail'
import { Welcome } from './pages/Welcome'
import { CookiePolicy } from './pages/legal/CookiePolicy'
import { Disclaimer } from './pages/legal/Disclaimer'
import { PrivacyPolicy } from './pages/legal/PrivacyPolicy'
import { TermsOfService } from './pages/legal/TermsOfService'

function RootRedirect() {
  const { isAuthenticated } = useAuth()
  if (isAuthenticated) {
    return <Navigate to={getDefaultLanding()} replace />
  }
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
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/disclaimer" element={<Disclaimer />} />
        <Route path="/cookies" element={<CookiePolicy />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="markets" element={<Markets />} />
            <Route path="news" element={<News />} />
            <Route path="insider" element={<InsiderActivity />} />
            <Route path="charts" element={<TechnicalAnalysis />} />
            <Route path="analysis/:symbol" element={<TechnicalAnalysis />} />
            <Route path="sectors" element={<Sectors />} />
            {import.meta.env.VITE_FEATURE_BACKTEST === '1' ? (
              <Route path="strategies" element={<Strategies />} />
            ) : (
              <Route path="strategies" element={<Navigate to="/dashboard" replace />} />
            )}
            <Route path="watchlist" element={<Watchlist />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="portfolio" element={<Portfolio />} />
            <Route path="heatmap" element={<Navigate to="/sectors" replace />} />
            <Route path="settings" element={<Settings />} />
            <Route path="gainers-losers" element={<Navigate to="/markets" replace />} />
            <Route path="technical-analysis" element={<Navigate to="/charts" replace />} />
            <Route path="sector-quadrant" element={<Navigate to="/sectors" replace />} />
          </Route>
        </Route>
      </Routes>
    </>
  )
}

function AlertWrapper({ children }) {
  const { token } = useAuth()
  return <AlertProvider token={token}>{children}</AlertProvider>
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AlertWrapper>
            <AppRoutes />
          </AlertWrapper>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
