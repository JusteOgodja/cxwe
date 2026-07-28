import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-4 text-center">
      <p className="text-8xl font-bold text-stone-200 select-none">404</p>
      <h1 className="text-2xl font-bold text-stone-800 mt-4 mb-2">Page introuvable</h1>
      <p className="text-stone-500 text-sm max-w-xs mb-8">
        La page que vous cherchez n'existe pas ou a été déplacée.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 bg-ma-red hover:bg-[#9B1E24] text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour à l'accueil
      </Link>
    </div>
  );
}
