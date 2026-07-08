import { Link } from 'react-router-dom';
import { PageLayout } from '../../components/layout/PageLayout/index.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { ROUTES } from '../../constants/routes.js';
import { HelpCircle } from 'lucide-react';
import './index.css';

/**
 * NotFound Page — custom 404 page for unmatched routes.
 */
export default function NotFound() {
  useDocumentTitle('Page Not Found');

  return (
    <PageLayout>
      <div className="not-found-page">
        <div className="not-found-page__content">
          <div className="not-found-page__icon-wrap" aria-hidden="true">
            <HelpCircle size={48} className="not-found-page__icon" />
          </div>
          <span className="not-found-page__code">404</span>
          <h1 className="not-found-page__title">Page Not Found</h1>
          <p className="not-found-page__message">
            Sorry, we couldn't find the page you're looking for. It might have been moved, deleted, or never existed in the first place.
          </p>
          <Link to={ROUTES.HOME} className="btn btn--primary btn--lg not-found-page__btn">
            Go back home
          </Link>
        </div>
      </div>
    </PageLayout>
  );
}
