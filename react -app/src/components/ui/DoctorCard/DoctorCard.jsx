import './DoctorCard.css';
import Badge from '../Badge/Badge';

/**
 * DoctorCard — Waitless UI Kit
 *
 * @prop {string}   name        - Doctor's full name e.g. "Dr. Layla Hassan"
 * @prop {string}   specialty   - e.g. "Consultant Cardiologist"
 * @prop {number}   rating      - 0–5 (supports half stars)
 * @prop {number}   reviewCount
 * @prop {number}   price       - consultation fee in EGP
 * @prop {string}   location    - e.g. "Maadi +1"
 * @prop {Array}    badges      - array of { variant, label } objects for Badge component
 * @prop {function} onClick
 *
 * @example
 * <DoctorCard
 *   name="Dr. Layla Hassan"
 *   specialty="Consultant Cardiologist"
 *   rating={4.9}
 *   reviewCount={312}
 *   price={350}
 *   location="Maadi +1"
 *   badges={[
 *     { variant: 'cardiology', label: 'Cardiology' },
 *     { variant: 'today',      label: 'Today' },
 *   ]}
 *   onClick={() => navigate('/doctor/layla-hassan')}
 * />
 */

function hashName(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 6;
}

function getInitials(name) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .replace(/^Dr\.?/i, '')
    .trim()
    .slice(0, 2)
    .toUpperCase();
}

function renderStars(rating) {
  const full  = Math.floor(rating);
  const empty = 5 - full;
  return '★'.repeat(full) + '☆'.repeat(empty);
}

export default function DoctorCard({
  name,
  specialty,
  rating = 5,
  reviewCount = 0,
  price,
  location,
  badges = [],
  onClick,
  className = '',
}) {
  const colorIndex = hashName(name);
  const initials   = getInitials(name);

  return (
    <div className={`doctor-card ${className}`} onClick={onClick} role="button" tabIndex={0}>
      <div className="doctor-card__header">
        <div className={`doctor-card__avatar doctor-card__avatar--${colorIndex}`}>
          {initials}
        </div>

        <div className="doctor-card__info">
          <h3 className="doctor-card__name">{name}</h3>
          <p className="doctor-card__specialty">{specialty}</p>
          <div className="doctor-card__rating">
            <span className="doctor-card__stars">{renderStars(rating)}</span>
            <span className="doctor-card__review-count">
              {rating} ({reviewCount})
            </span>
          </div>
        </div>
      </div>

      {badges.length > 0 && (
        <div className="doctor-card__badges">
          {badges.map((b, i) => (
            <Badge key={i} variant={b.variant}>{b.label}</Badge>
          ))}
        </div>
      )}

      <div className="doctor-card__footer">
        <div className="doctor-card__price">
          <span className="doctor-card__price-amount">{price}</span>
          <span className="doctor-card__price-currency">EGP</span>
        </div>
        {location && <span className="doctor-card__location">{location}</span>}
      </div>
    </div>
  );
}
