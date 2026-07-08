import { useState } from 'react';
import { useNavigate, useLocation, Navigate, Link } from 'react-router-dom';
import { PageLayout } from '../../components/layout/PageLayout/index.jsx';
import { InputField } from '../../components/ui/InputField/index.jsx';
import { Button } from '../../components/ui/Button/index.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useToast } from '../../hooks/useToast.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { login } from '../../services/authService.js';
import { ROUTES } from '../../constants/routes.js';
import { validateEmail, validatePassword } from '../../utils/validators.js';
import { extractErrorMessage } from '../../utils/extractErrorMessage.js';
import './index.css';

/**
 * Login Page — collects email and password, validates, authenticates,
 * and redirects to the page the user tried to access or the Home page.
 */
export default function Login() {
  useDocumentTitle('Sign In');

  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, setUser } = useAuth();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [backendError, setBackendError] = useState(null);

  // Redirect destination after successful login
  const from = location.state?.from?.pathname || ROUTES.HOME;

  // If already authenticated, redirect
  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
    setErrors((prev) => ({ ...prev, [id]: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setBackendError(null);

    // Validate
    const formErrors = {};
    const emailErr = validateEmail(formData.email);
    if (emailErr) formErrors.email = emailErr;

    const passErr = validatePassword(formData.password);
    if (passErr) formErrors.password = passErr;

    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }

    setSubmitting(true);
    try {
      const data = await login({
        email: formData.email.trim(),
        password: formData.password,
      });

      // Call context setUser with correct keys
      setUser({
        userId: data.userId,
        username: data.username,
        role: data.role,
        token: data.jwtToken,
      });

      showToast('success', `Welcome back, ${data.username}!`);
      const target = data.role === 'admin' ? ROUTES.ADMIN : (from === ROUTES.HOME ? ROUTES.HOME : from);
      navigate(target, { replace: true });
    } catch (err) {
      const errorMsg = extractErrorMessage(err, 'Failed to sign in. Please try again.');
      setBackendError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageLayout>
      <div className="login-page">
        <div className="login-page__card">
          <header className="login-page__header">
            <h1 className="login-page__title">Sign In</h1>
            <p className="login-page__subtitle">Welcome back to ShopCart</p>
          </header>

          {backendError && (
            <div className="login-page__error-banner" role="alert">
              <p className="login-page__error-message">{backendError}</p>
            </div>
          )}

          <form className="login-page__form" onSubmit={handleSubmit} noValidate>
            {/* Email field */}
            <InputField
              id="email"
              label="Email Address"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleInputChange}
              error={errors.email}
              required
              disabled={submitting}
            />

            {/* Password field */}
            <InputField
              id="password"
              label="Password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleInputChange}
              error={errors.password}
              required
              disabled={submitting}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="login-page__submit-btn"
              loading={submitting}
            >
              Sign In
            </Button>
          </form>

          <footer className="login-page__footer">
            <p className="login-page__footer-text">
              Don't have an account?{' '}
              <Link to={ROUTES.REGISTER} className="login-page__link">
                Sign Up
              </Link>
            </p>
          </footer>
        </div>
      </div>
    </PageLayout>
  );
}
