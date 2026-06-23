import './Navbar.css';
import Button from '../../ui/Button/Button';

/**
 * Navbar — Waitless UI Kit
 *
 * @prop {Array}  links        - [{ label, href, active? }]
 * @prop {string} signInHref   - href for Sign In link
 * @prop {string} ctaLabel     - CTA button text (default "Get Started")
 * @prop {func}   onCtaClick
 * @prop {string} logoHref     - href for logo link (default "#")
 *
 * @example
 * <Navbar
 *   links={[
 *     { label: 'Find Doctors', href: '/doctors' },
 *     { label: 'Specialties', href: '/specialties' },
 *     { label: 'For Clinics', href: '/clinics' },
 *     { label: 'My Bookings', href: '/bookings', active: true },
 *   ]}
 *   signInHref="/login"
 *   ctaLabel="Get Started"
 *   onCtaClick={() => navigate('/register')}
 * />
 */

const WaitlessLogo = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <polyline
      points="1,12 5,12 7,16 10,4 13,16 15,12 23,12"
      stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    />
  </svg>
);

export default function Navbar({
  links = [
    { label: 'Find Doctors', href: '#' },
    { label: 'Specialties',  href: '#' },
    { label: 'For Clinics',  href: '#' },
    { label: 'My Bookings',  href: '#' },
  ],
  signInHref  = '#',
  ctaLabel    = 'Get Started',
  onCtaClick,
  logoHref    = '#',
}) {
  return (
    <nav className="navbar">
      <div className="navbar__inner">

        {/* Logo */}
        <a href={logoHref} className="navbar__logo">
          <div className="navbar__logo-icon">
            <WaitlessLogo />
          </div>
          <span className="navbar__logo-text">Waitless</span>
        </a>

        {/* Nav links */}
        <ul className="navbar__links">
          {links.map((link) => (
            <li key={link.label}>
              <a
                href={link.href}
                className={`navbar__link${link.active ? ' navbar__link--active' : ''}`}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        {/* Auth */}
        <div className="navbar__auth">
          <a href={signInHref} className="navbar__sign-in">Sign In</a>
          <Button variant="gold" size="sm" onClick={onCtaClick}>
            {ctaLabel}
          </Button>
        </div>

      </div>
    </nav>
  );
}
