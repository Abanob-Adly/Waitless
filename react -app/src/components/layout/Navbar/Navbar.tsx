import './Navbar.css';
import Button from '../../ui/Button/Button';

interface NavLink {
  label: string;
  href: string;
  active?: boolean;
}

interface NavbarProps {
  links?: NavLink[];
  signInHref?: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
  logoHref?: string;
}

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
  onCtaClick  = () => {},
  logoHref    = '#',
}: NavbarProps) {
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