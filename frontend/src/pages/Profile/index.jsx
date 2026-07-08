import { useNavigate } from 'react-router-dom';
import { PageLayout } from '../../components/layout/PageLayout/index.jsx';
import { Badge } from '../../components/ui/Badge/index.jsx';
import { Button } from '../../components/ui/Button/index.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { ROUTES } from '../../constants/routes.js';
import './index.css';

/**
 * Profile Page — displays basic user account details (read-only from token payload).
 * Shows username, role, userId, and session state.
 */
export default function Profile() {
  useDocumentTitle('Profile');

  const navigate = useNavigate();
  const { user, clearUser } = useAuth();

  const handleLogout = () => {
    clearUser();
    navigate(ROUTES.HOME, { replace: true });
  };

  // Safe fallback if user state is not populated
  const username = user?.username || 'User';
  const role = user?.role || 'customer';
  const userId = user?.userId || 'N/A';

  // Determine badge variant by role
  let roleVariant = 'default';
  if (role === 'admin') roleVariant = 'error';
  else if (role === 'supplier') roleVariant = 'info';
  else if (role === 'customer') roleVariant = 'success';

  // Extract first letter of name for decorative avatar
  const avatarLetter = username.charAt(0).toUpperCase();

  return (
    <PageLayout>
      <div className="profile-page container">
        <div className="profile-page__card">
          <header className="profile-page__header">
            <div className="profile-page__avatar" aria-hidden="true">
              {avatarLetter}
            </div>
            <h1 className="profile-page__name">{username}</h1>
            <Badge variant={roleVariant}>{role}</Badge>
          </header>

          <div className="profile-page__details">
            <h2 className="profile-page__section-title">Account Details</h2>
            
            <div className="profile-page__row">
              <span className="profile-page__label">User ID</span>
              <span className="profile-page__value">{userId}</span>
            </div>

            <div className="profile-page__row">
              <span className="profile-page__label">Role</span>
              <span className="profile-page__value text-capitalize">{role}</span>
            </div>

            <div className="profile-page__row">
              <span className="profile-page__label">Session Status</span>
              <span className="profile-page__value profile-page__value--session">
                <span className="profile-page__session-indicator" />
                Active Session
              </span>
            </div>
          </div>

          <footer className="profile-page__footer">
            <Button
              variant="outline"
              size="md"
              className="profile-page__logout-btn"
              onClick={handleLogout}
            >
              Sign Out
            </Button>
          </footer>
        </div>
      </div>
    </PageLayout>
  );
}
