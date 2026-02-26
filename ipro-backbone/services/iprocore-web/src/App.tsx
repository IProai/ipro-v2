import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { PortfolioPage } from './pages/PortfolioPage';
import { ControlTowerPage } from './pages/ControlTowerPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { HelpPage } from './pages/HelpPage';
import { RoleSimulatorPage } from './pages/RoleSimulatorPage';
import { AISuggestionsPage } from './pages/AISuggestionsPage';
import { AIActivityPage } from './pages/AIActivityPage';
import { AIPlaybooksPage } from './pages/AIPlaybooksPage';
import { ProtectedRoute } from './components/ProtectedRoute';

/**
 * Route constitution — Phase 01 + Phase 02 routes.
 * Blueprint §11 Route Constitution.
 */
export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                {/* Auth */}
                <Route path="/login" element={<LoginPage />} />

                {/* Phase 01 protected routes */}
                <Route
                    path="/console/dashboard"
                    element={<ProtectedRoute><DashboardPage /></ProtectedRoute>}
                />
                <Route
                    path="/console/control-tower/portfolio"
                    element={<ProtectedRoute><PortfolioPage /></ProtectedRoute>}
                />

                {/* Phase 02: Control Tower */}
                <Route
                    path="/console/control-tower"
                    element={<ProtectedRoute><ControlTowerPage /></ProtectedRoute>}
                />

                {/* Phase 02: Onboarding */}
                <Route
                    path="/console/onboarding"
                    element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>}
                />
                <Route
                    path="/console/onboarding/checklist"
                    element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>}
                />
                <Route
                    path="/console/onboarding/setup-wizard"
                    element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>}
                />

                {/* Phase 02: Help & Support (4 routes per spec) */}
                <Route
                    path="/console/help"
                    element={<ProtectedRoute><HelpPage /></ProtectedRoute>}
                />
                <Route
                    path="/console/help/knowledge-base"
                    element={<ProtectedRoute><HelpPage /></ProtectedRoute>}
                />
                <Route
                    path="/console/help/tutorials"
                    element={<ProtectedRoute><HelpPage /></ProtectedRoute>}
                />
                <Route
                    path="/console/help/tickets"
                    element={<ProtectedRoute><HelpPage /></ProtectedRoute>}
                />

                {/* Phase 03: Security — Role Simulator (Founder-only) */}
                <Route
                    path="/console/security/role-simulator"
                    element={<ProtectedRoute><RoleSimulatorPage /></ProtectedRoute>}
                />

                {/* Phase 05: AI Assist (Governance-locked) */}
                <Route
                    path="/console/ai/suggestions"
                    element={<ProtectedRoute><AISuggestionsPage /></ProtectedRoute>}
                />
                <Route
                    path="/console/ai/activity"
                    element={<ProtectedRoute><AIActivityPage /></ProtectedRoute>}
                />
                <Route
                    path="/console/ai/playbooks"
                    element={<ProtectedRoute><AIPlaybooksPage /></ProtectedRoute>}
                />

                {/* Default redirect */}
                <Route path="/" element={<Navigate to="/console/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/console/dashboard" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

