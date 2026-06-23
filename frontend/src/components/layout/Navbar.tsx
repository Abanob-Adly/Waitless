import { Button } from "../ui/Button";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-navy text-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <a href="/" className="font-heading text-2xl font-bold text-white">
          Waitless
        </a>

        <nav className="hidden items-center gap-8 text-sm md:flex">
          <a href="#" className="text-white/80 hover:text-gold-light">
            Find Doctors
          </a>
          <a href="#" className="text-white/80 hover:text-gold-light">
            Specialties
          </a>
          <a href="#" className="text-white/80 hover:text-gold-light">
            For Clinics
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <button className="hidden text-sm text-white/80 hover:text-white sm:block">
            Sign In
          </button>
          <Button size="sm">Get Started</Button>
        </div>
      </div>
    </header>
  );
}
