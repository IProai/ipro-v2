import { Navigate } from 'react-router-dom';
import { authStore } from '../lib/auth';

interface Props {
    children: React.ReactNode;
}

/**
 * Wraps console routes — redirects to /login if no access token.
 * In Phase 03 we'll add token refresh here before full guard.
 */
export function ProtectedRoute({ children }: Props) {
    if (!authStore.isAuthenticated()) {
        return <Navigate to="/login" replace />;
    }
    return <>{children}</>;
}
