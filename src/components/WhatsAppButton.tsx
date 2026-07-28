export default function WhatsAppButton() {
  const phone = '212605268946';
  const msg = encodeURIComponent('Bonjour, je souhaite des informations sur vos produits alimentaires marocains.');
  return (
    <a
      href={`https://wa.me/${phone}?text=${msg}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contactez-nous sur WhatsApp"
      className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 group"
      style={{ background: '#25D366' }}
    >
      {/* WhatsApp SVG icon */}
      <svg viewBox="0 0 32 32" className="w-7 h-7 fill-white" xmlns="http://www.w3.org/2000/svg">
        <path d="M16.004 2C8.28 2 2 8.28 2 16c0 2.47.65 4.8 1.79 6.82L2 30l7.35-1.77A13.94 13.94 0 0016.004 30C23.72 30 30 23.72 30 16S23.72 2 16.004 2zm0 25.4a11.57 11.57 0 01-5.9-1.61l-.42-.25-4.36 1.05 1.08-4.24-.28-.44A11.57 11.57 0 014.6 16c0-6.29 5.11-11.4 11.4-11.4S27.4 9.71 27.4 16 22.29 27.4 16.004 27.4zM22.1 18.9c-.33-.17-1.97-.97-2.27-1.08-.3-.11-.52-.17-.74.17-.22.34-.85 1.08-1.04 1.3-.19.22-.39.25-.72.08-.33-.17-1.4-.52-2.67-1.65-.99-.88-1.65-1.97-1.85-2.3-.19-.33-.02-.51.15-.67.15-.15.33-.39.5-.58.17-.19.22-.33.33-.55.11-.22.06-.41-.03-.58-.08-.17-.74-1.78-1.01-2.44-.27-.64-.54-.55-.74-.56-.19-.01-.41-.01-.63-.01-.22 0-.58.08-.88.41-.3.33-1.15 1.12-1.15 2.74s1.18 3.18 1.34 3.4c.17.22 2.32 3.54 5.62 4.97.79.34 1.4.54 1.88.69.79.25 1.51.22 2.08.13.63-.1 1.97-.8 2.25-1.58.28-.77.28-1.43.19-1.57-.08-.14-.3-.22-.63-.39z"/>
      </svg>
      {/* Tooltip */}
      <span className="absolute right-16 bg-stone-900 text-white text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-md">
        Chattez sur WhatsApp
      </span>
    </a>
  );
}
