import { useState } from 'react';
import './SearchSection.css';

/**
 * SearchSection — Waitless UI Kit
 *
 * @prop {string}   title          - section heading
 * @prop {string}   subtitle       - section subtitle
 * @prop {Array}    specialties    - options for the specialty dropdown
 * @prop {Array}    areas          - options for the area dropdown
 * @prop {string}   searchLabel    - button label (default "Search")
 * @prop {function} onSearch       - called with { specialty, area, query }
 *
 * @example
 * <SearchSection
 *   specialties={['All Specialties','Cardiology','Dermatology','Pediatrics']}
 *   areas={['All Areas','Maadi','Nasr City','Dokki','Heliopolis']}
 *   onSearch={({ specialty, area, query }) => handleSearch(specialty, area, query)}
 * />
 */
export default function SearchSection({
  title      = 'Find Your Doctor',
  subtitle   = 'Search by specialty, area or doctor name',
  specialties = ['All Specialties', 'Cardiology', 'Dermatology', 'Pediatrics', 'Orthopedics'],
  areas       = ['All Areas', 'Maadi', 'Nasr City', 'Dokki', 'Heliopolis', '5th Settlement'],
  searchLabel = 'Search',
  onSearch,
}) {
  const [specialty, setSpecialty] = useState(specialties[0]);
  const [area,      setArea]      = useState(areas[0]);
  const [query,     setQuery]     = useState('');

  function handleSearch() {
    onSearch?.({ specialty, area, query });
  }

  function handleKeyDown(e) {
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
            onChange={(e) => setSpecialty(e.target.value)}
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
            onChange={(e) => setArea(e.target.value)}
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
            onChange={(e) => setQuery(e.target.value)}
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
