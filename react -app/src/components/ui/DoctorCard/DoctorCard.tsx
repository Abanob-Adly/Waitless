import './DoctorCard.css';
import Badge from '../Badge/Badge';

interface DoctorBadge {
  variant: string;
  label: string;
}

interface DoctorCardProps {
  name: string;
  specialty: string;
  rating?: number;
  reviewCount?: number;
  price: number;
  location?: string;
  badges?: DoctorBadge[];
  onClick?: () => void;
  className?: string;
}

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 6;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .replace(/^Dr\.?/i, '')
    .trim()
    .slice(0, 2)
    .toUpperCase();
}

function renderStars(rating: number): string {
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
}: DoctorCardProps) {
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
            <Badge key={i} variant={b.variant as any}>{b.label}</Badge>
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