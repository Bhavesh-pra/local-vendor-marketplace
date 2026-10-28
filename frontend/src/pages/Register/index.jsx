import { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { PageLayout } from '../../components/layout/PageLayout/index.jsx';
import { InputField } from '../../components/ui/InputField/index.jsx';
import { Button } from '../../components/ui/Button/index.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useToast } from '../../hooks/useToast.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { register } from '../../services/authService.js';
import { ROUTES } from '../../constants/routes.js';
import { validateEmail, validatePassword, validateRequired } from '../../utils/validators.js';
import { extractErrorMessage } from '../../utils/extractErrorMessage.js';
import './index.css';

/**
 * Register Page — collects registration details, validates, creates a customer account,
 * and redirects to the login page upon success.
 */
export default function Register() {
  useDocumentTitle('Create Account');

  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [backendError, setBackendError] = useState(null);

  // If already authenticated, redirect to Home
  if (isAuthenticated) {
    return <Navigate to={ROUTES.HOME} replace />;
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
    const nameErr = validateRequired(formData.username, 'Name');
    if (nameErr) formErrors.username = nameErr;

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
      await register({
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password,
      });

      showToast('success', 'Account created successfully! Please sign in.');
      navigate(ROUTES.LOGIN);
    } catch (err) {
      const errorMsg = extractErrorMessage(err, 'Failed to create account. Please try again.');
      setBackendError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageLayout>
      <div className="register-page">
        <div className="register-page__card">
          <header className="register-page__header">
            <h1 className="register-page__title">Create Account</h1>
            <p className="register-page__subtitle">Join ShopCart today</p>
          </header>

          {backendError && (
            <div className="register-page__error-banner" role="alert">
              <p className="register-page__error-message">{backendError}</p>
            </div>
          )}

          <form className="register-page__form" onSubmit={handleSubmit} noValidate>
            {/* Username field */}
            <InputField
              id="username"
              label="Username"
              type="text"
              autoComplete="username"
              placeholder="johndoe"
              value={formData.username}
              onChange={handleInputChange}
              error={errors.username}
              required
              disabled={submitting}
            />

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
              autoComplete="new-password"
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
              className="register-page__submit-btn"
              loading={submitting}
            >
              Sign Up
            </Button>
          </form>

          <footer className="register-page__footer">
            <p className="register-page__footer-text">
              Already have an account?{' '}
              <Link to={ROUTES.LOGIN} className="register-page__link">
                Sign In
              </Link>
            </p>
          </footer>
        </div>
      </div>
    </PageLayout>
  );
}
