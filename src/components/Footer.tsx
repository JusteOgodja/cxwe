import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Linkedin } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="bg-ma-navy" id="contact">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">

          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="mb-5">
              <img src="/logo.png" alt="Morocco Food Export" className="h-20 sm:h-32 w-auto" />
            </div>
            <p className="text-stone-400 text-sm leading-relaxed max-w-sm">
              {t('footer.tagline')}
            </p>
            <div className="mt-6 flex items-center gap-2">
              <span className="inline-block w-6 h-0.5 bg-ma-gold rounded-full" />
              <span className="text-ma-gold text-xs font-medium tracking-wider uppercase">{t('footer.quality')}</span>
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="text-white font-semibold mb-4 text-xs uppercase tracking-widest">{t('footer.links')}</h3>
            <ul className="space-y-2.5">
              {[
                { label: t('footer.linkHome'), to: '/' },
                { label: t('footer.linkCatalog'), to: '/catalog' },
                { label: t('footer.linkQuote'), to: '/quote' },
                { label: t('footer.linkPartner'), to: '/partner' },
              ].map(link => (
                <li key={link.to}>
                  <Link to={link.to} className="text-stone-400 hover:text-white text-sm transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-white font-semibold mb-4 text-xs uppercase tracking-widest">{t('footer.contact')}</h3>
            <p className="text-stone-500 text-[10px] mb-3 uppercase tracking-widest font-medium">{t('footer.cofounder')}</p>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-ma-gold mt-0.5 shrink-0" />
                <a href="mailto:filalianas0001@gmail.com" className="text-stone-400 hover:text-white text-sm transition-colors break-all">
                  filalianas0001@gmail.com
                </a>
              </li>
              <li className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-ma-gold mt-0.5 shrink-0" />
                <a href="tel:+212605268946" className="text-stone-400 hover:text-white text-sm transition-colors">
                  +212 605 268 946
                </a>
              </li>
              <li className="flex items-start gap-3">
                <Linkedin className="w-4 h-4 text-ma-gold mt-0.5 shrink-0" />
                <a
                  href="https://www.linkedin.com/in/anasfilali01/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-stone-400 hover:text-white text-sm transition-colors"
                >
                  Anas Filali
                </a>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-ma-gold mt-0.5 shrink-0" />
                <span className="text-stone-400 text-sm">Casablanca, Maroc</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/5 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-stone-600 text-xs">
            &copy; {new Date().getFullYear()} Morocco Food Export. {t('footer.rights')}
          </p>
          <p className="text-stone-600 text-xs">Morocco Food Export — Quality from Morocco, Trusted by the World</p>
        </div>
      </div>
    </footer>
  );
}
