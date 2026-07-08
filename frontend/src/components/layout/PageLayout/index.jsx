import { Header } from '../Header/index.jsx';
import { Footer } from '../Footer/index.jsx';
import './index.css';

/**
 * PageLayout — wraps every page with Header, main content area, and Footer.
 *
 * The container is intentionally NOT applied here so that individual pages
 * and sections can choose their own width — full-bleed (Hero, banners) or
 * constrained (.container).
 *
 * @param {import('react').ReactNode} children
 */
export function PageLayout({ children }) {
  return (
    <>
      <Header />
      <main id="main-content" className="page-layout__main" role="main" tabIndex={-1}>
        {children}
      </main>
      <Footer />
    </>
  );
}
