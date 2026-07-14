import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Handshake } from 'lucide-react';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setOpen(false), [location]);

  const isActive = (path: string) =>
    location.pathname === path
      ? 'text-ma-gold font-semibold'
      : 'text-stone-300 hover:text-white';

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled || open
          ? 'bg-ma-navy/96 backdrop-blur-md shadow-nav'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div
              className="relative rounded-full shrink-0 transition-all duration-300"
              style={{
                background: 'radial-gradient(circle, rgba(201,136,58,0.18) 0%, transparent 70%)',
                boxShadow: '0 0 14px rgba(201,136,58,0.30), 0 0 28px rgba(201,136,58,0.12)',
              }}
            >
              <img
                src="/logo.png"
                alt="Morocco Food Export"
                className="h-14 w-auto rounded-full block"
                style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))' }}
              />
            </div>
            <div className="leading-tight hidden sm:block">
              <div className="text-white font-bold text-sm tracking-wide">Morocco Food Export</div>
              <div className="text-ma-gold text-[10px] tracking-widest uppercase font-medium">Quality from Morocco</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            <Link to="/" className={`text-sm transition-colors ${isActive('/')}`}>Accueil</Link>
            <Link to="/catalog" className={`text-sm transition-colors ${isActive('/catalog')}`}>Catalogue</Link>
            <Link to="/confiance" className={`text-sm transition-colors ${isActive('/confiance')}`}>Confiance</Link>
            <Link to="/quote" className={`text-sm transition-colors ${isActive('/quote')}`}>Demander un devis</Link>
            <Link to="/partner" className={`flex items-center gap-1.5 text-sm transition-colors ${isActive('/partner')}`}>
              <Handshake className="w-3.5 h-3.5" /> Collaborer
            </Link>
          </nav>

          {/* CTA buttons */}
          <div className="hidden md:flex items-center gap-2.5">
            <Link
              to="/partner"
              className="flex items-center gap-1.5 border border-ma-green/40 hover:border-ma-green text-ma-green hover:text-white hover:bg-ma-green text-sm font-medium px-4 py-2 rounded-lg transition-all"
            >
              <Handshake className="w-3.5 h-3.5" /> Collaborer
            </Link>
            <Link
              to="/quote"
              className="bg-ma-red hover:bg-[#A83928] text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors shadow-sm"
            >
              Devis
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-ma-navy border-t border-white/5 px-4 py-4 space-y-1">
          {[
            { to: '/', label: 'Accueil' },
            { to: '/catalog', label: 'Catalogue' },
            { to: '/confiance', label: 'Confiance & Qualité' },
            { to: '/quote', label: 'Demander un devis' },
          ].map(l => (
            <Link key={l.to} to={l.to} className="block text-stone-300 hover:text-white hover:bg-white/5 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors">
              {l.label}
            </Link>
          ))}
          <Link to="/partner" className="flex items-center gap-1.5 text-ma-green hover:text-white hover:bg-white/5 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors">
            <Handshake className="w-4 h-4" /> Collaborer avec nous
          </Link>
          <Link
            to="/quote"
            className="block bg-ma-red hover:bg-[#A83928] text-white text-center text-sm font-semibold px-4 py-2.5 rounded-lg mt-2 transition-colors"
          >
            Demander un devis
          </Link>
        </div>
      )}
    </header>
  );
}
