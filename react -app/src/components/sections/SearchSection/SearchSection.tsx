import { useState } from 'react';
import './SearchSection.css';

interface SearchValues {
  specialty: string;
  area: string;
  query: string;
}

interface SearchSectionProps {
  title?: string;
  subtitle?: string;
  specialties?: string[];
  areas?: string[];
  searchLabel?: string;
  onSearch?: (values: SearchValues) => void;
}

export default function SearchSection({
  title       = 'Find Your Doctor',
  subtitle    = 'Search by specialty, area or doctor name',
  specialties = ['All Specialties', 'Cardiology', 'Dermatology', 'Pediatrics', 'Orthopedics'],
  areas       = ['All Areas', 'Maadi', 'Nasr City', 'Dokki', 'Heliopolis', '5th Settlement'],
  searchLabel = 'Search',
  onSearch,
}: SearchSectionProps) {
  const [specialty, setSpecialty] = useState<string>(specialties[0] ?? '');
  const [area,      setArea]      = useState<string>(areas[0] ?? '');
  const [query,     setQuery]     = useState<string>('');

  function handleSearch(): void {
    onSearch?.({ specialty, area, query });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') handleSearch();
  }

  return (
    <section className="search-section">
      <div className="search-container">

        <div className="search-header">
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>

        <div className="search-bar-wrapper">

          {/* Specialty */}
          <select
            className="search-input"
            value={specialty}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSpecialty(e.target.value)}
            aria-label="Specialty"
          >
            {specialties.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Area */}
          <select
            className="search-input"
            value={area}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setArea(e.target.value)}
            aria-label="Area"
          >
            {areas.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          {/* Keyword */}
          <input
            type="text"
            className="search-input"
            placeholder="Search doctors..."
            value={query}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Search doctors"
          />

          {/* Button */}
          <button className="search-btn" onClick={handleSearch}>
            {searchLabel}
          </button>

        </div>
      </div>
    </section>
  );
}