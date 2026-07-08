import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ShoppingCart, Menu, X, User, LogOut, Package } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth.js';
import { useCart } from '../../../hooks/useCart.js';
import { ROUTES } from '../../../constants/routes.js';
import './index.css';

/**
 * Header — global navigation shell.
 *
 * Navigation: ShopCart Logo → Shop → Orders (auth) → Add Product (supplier/admin) → Cart → Profile
 * Mobile: hamburger toggle + slide-in drawer from right.
 */
export function Header() {
  const { isAuthenticated, user, role, clearUser } = useAuth();
  const { itemCount } = useCart();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();
  const profileContainerRef = useRef(null);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
    setProfileMenuOpen(false);
  }, [location.pathname]);

  // Track scroll position to adjust background blur / opacity
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close drawer on Escape key
  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  // Close profile dropdown on click outside
  useEffect(() => {
    if (!profileMenuOpen) return;
    const handleClickOutside = (event) => {
      if (profileContainerRef.current && !profileContainerRef.current.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileMenuOpen]);

  // Close profile dropdown on Escape key
  useEffect(() => {
    if (!profileMenuOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setProfileMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [profileMenuOpen]);

  // Prevent body scroll when drawer is open; compensate scrollbar width to avoid layout shift
  useEffect(() => {
    if (drawerOpen) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    } else {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    };
  }, [drawerOpen]);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const toggleDrawer = useCallback(() => setDrawerOpen((v) => !v), []);

  const isSupplierOrAdmin = role === 'supplier' || role === 'admin';

  return (
    <>
      {/* Skip to content */}
      <a href="#main-content" className="skip-link">Skip to content</a>

      <header className={`header ${isScrolled ? 'header--scrolled' : ''}`} role="banner">
        <div className="header__inner container">

          {/* Left group: Brand + Nav */}
          <div className="header__left">
            <Link to={ROUTES.HOME} className="header__logo" aria-label="ShopCart home">
              <span className="header__logo-text">ShopCart</span>
              <span className="header__logo-accent" aria-hidden="true" />
            </Link>

            {/* Desktop nav */}
            <nav className="header__nav" aria-label="Main navigation">
              <NavLink
                to={ROUTES.HOME}
                className={({ isActive }) =>
                  `header__nav-link ${isActive ? 'header__nav-link--active' : ''}`
                }
                aria-current={location.pathname === ROUTES.HOME ? 'page' : undefined}
              >
                Shop
              </NavLink>

              {isAuthenticated && (
                <NavLink
                  to={ROUTES.ORDERS}
                  className={({ isActive }) =>
                    `header__nav-link ${isActive ? 'header__nav-link--active' : ''}`
                  }
                >
                  Orders
                </NavLink>
              )}

              {isSupplierOrAdmin && (
                <NavLink
                  to={ROUTES.ADMIN_PRODUCTS}
                  className={({ isActive }) =>
                    `header__nav-link ${isActive ? 'header__nav-link--active' : ''}`
                  }
                >
                  Products
                </NavLink>
              )}
            </nav>
          </div>

          {/* Desktop actions (Cart + Profile) */}
          <div className="header__actions">
            {/* Cart Link (Always visible, redirects if protected) */}
            <Link
              to={ROUTES.CART}
              className="header__action-btn header__cart-btn"
              aria-label={`Shopping cart, ${itemCount} item${itemCount !== 1 ? 's' : ''}`}
            >
              <ShoppingCart size={20} aria-hidden="true" />
              {itemCount > 0 && (
                <span className="header__cart-badge" aria-hidden="true">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </Link>

            {/* Profile Menu Dropdown */}
            {isAuthenticated ? (
              <div className="header__profile-container" ref={profileContainerRef}>
                <button
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                  className={`header__action-btn header__profile-btn ${profileMenuOpen ? 'header__profile-btn--active' : ''}`}
                  aria-label="User profile menu"
                  aria-expanded={profileMenuOpen}
                  type="button"
                >
                  <User size={20} aria-hidden="true" />
                </button>
                {profileMenuOpen && (
                  <div className="header__profile-dropdown">
                    <div className="header__profile-info">
                      <p className="header__profile-welcome">Welcome,</p>
                      <p className="header__profile-username">{user?.username}</p>
                      <span className="header__profile-role">{role}</span>
                    </div>
                    <div className="header__profile-divider" />
                    <Link
                      to={ROUTES.PROFILE}
                      className="header__dropdown-link"
                      onClick={() => setProfileMenuOpen(false)}
                    >
                      <User size={14} className="header__dropdown-icon" />
                      <span>Account Profile</span>
                    </Link>
                    {isSupplierOrAdmin && (
                      <Link
                        to={ROUTES.ADMIN_PRODUCTS}
                        className="header__dropdown-link"
                        onClick={() => setProfileMenuOpen(false)}
                      >
                        <Package size={14} className="header__dropdown-icon" />
                        <span>Products</span>
                      </Link>
                    )}
                    <div className="header__profile-divider" />
                    <button
                      onClick={() => {
                        clearUser();
                        setProfileMenuOpen(false);
                      }}
                      className="header__dropdown-logout"
                      type="button"
                    >
                      <LogOut size={14} className="header__dropdown-icon" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to={ROUTES.LOGIN}
                className="header__action-btn header__profile-btn"
                aria-label="Sign in"
              >
                <User size={20} aria-hidden="true" />
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="header__hamburger"
            onClick={toggleDrawer}
            aria-label={drawerOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={drawerOpen}
            aria-controls="mobile-drawer"
            type="button"
          >
            {drawerOpen
              ? <X size={22} aria-hidden="true" />
              : <Menu size={22} aria-hidden="true" />
            }
          </button>
        </div>

        {/* Mobile drawer backdrop */}
        {drawerOpen && (
          <div
            className="header__backdrop"
            onClick={closeDrawer}
            aria-hidden="true"
          />
        )}

        {/* Mobile drawer (slides in from right) */}
        <nav
          id="mobile-drawer"
          className={`header__drawer ${drawerOpen ? 'header__drawer--open' : ''}`}
          aria-label="Mobile navigation"
          aria-hidden={!drawerOpen}
          inert={!drawerOpen || undefined}
        >
          <div className="header__drawer-header">
            <span className="header__logo-text">ShopCart</span>
            <span className="header__logo-accent" aria-hidden="true" />
          </div>

          <div className="header__drawer-links">
            <NavLink to={ROUTES.HOME} className="header__drawer-link" onClick={closeDrawer}>
              Shop
            </NavLink>

            {isAuthenticated ? (
              <>
                <NavLink to={ROUTES.ORDERS} className="header__drawer-link" onClick={closeDrawer}>
                  Orders
                </NavLink>
                <NavLink to={ROUTES.CART} className="header__drawer-link" onClick={closeDrawer}>
                  Cart ({itemCount})
                </NavLink>
                <NavLink to={ROUTES.PROFILE} className="header__drawer-link" onClick={closeDrawer}>
                  Profile
                </NavLink>
                {isSupplierOrAdmin && (
                  <NavLink to={ROUTES.ADMIN_PRODUCTS} className="header__drawer-link" onClick={closeDrawer}>
                    Products
                  </NavLink>
                )}
                <div className="header__drawer-divider" />
                <button 
                  className="header__drawer-logout" 
                  onClick={() => { clearUser(); closeDrawer(); }} 
                  type="button"
                >
                  <LogOut size={16} aria-hidden="true" />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <>
                <div className="header__drawer-divider" />
                <NavLink to={ROUTES.LOGIN} className="header__drawer-link" onClick={closeDrawer}>
                  Sign In
                </NavLink>
                <NavLink to={ROUTES.REGISTER} className="header__drawer-link header__drawer-link--primary" onClick={closeDrawer}>
                  Create Account
                </NavLink>
              </>
            )}
          </div>
        </nav>
      </header>
    </>
  );
}
