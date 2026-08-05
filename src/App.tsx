import { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from './lib/supabase';
import { AuthProvider } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import WhatsAppButton from './components/WhatsAppButton';

// Routes non nécessaires au premier rendu (accueil) -> chargées à la demande.
// Le bundle critique ne garde que App/Navbar/Footer/routing/accueil.
const Catalog = lazy(() => import('./pages/Catalog'));
const CategoryPage = lazy(() => import('./pages/CategoryPage'));
const QuoteRequest = lazy(() => import('./pages/QuoteRequest'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const Login = lazy(() => import('./pages/Login'));
const SignUp = lazy(() => import('./pages/SignUp'));
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const Categories = lazy(() => import('./pages/admin/Categories'));
const Products = lazy(() => import('./pages/admin/Products'));
const Brands = lazy(() => import('./pages/admin/Brands'));
const Suppliers = lazy(() => import('./pages/admin/Suppliers'));
const Quotes = lazy(() => import('./pages/admin/Quotes'));
const Partners = lazy(() => import('./pages/admin/Partners'));
const Buyers = lazy(() => import('./pages/admin/Buyers'));
const DataQuality = lazy(() => import('./pages/admin/DataQuality'));
const Sources = lazy(() => import('./pages/admin/Sources'));
const Analytics = lazy(() => import('./pages/admin/Analytics'));
const Settings = lazy(() => import('./pages/admin/Settings'));
const Partner = lazy(() => import('./pages/Partner'));
const Trust = lazy(() => import('./pages/Trust'));
const BrandPage = lazy(() => import('./pages/BrandPage'));
const SampleRequest = lazy(() => import('./pages/SampleRequest'));
const HowItWorks = lazy(() => import('./pages/HowItWorks'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Fallback sobre, centré, cohérent avec le spinner d'authentification (pas
// d'écran blanc, pas de changement de layout majeur).
function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
    </div>
  );
}

function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}

function RTLSync() {
  const { i18n } = useTranslation();
  useEffect(() => {
    document.documentElement.lang = i18n.language;
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
  }, [i18n.language]);
  return null;
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(!!data.session);
      setAuthChecked(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AuthProvider>
      <RTLSync />
      <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<PublicLayout><Home /></PublicLayout>} />
        <Route path="/catalog" element={<PublicLayout><Catalog /></PublicLayout>} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route
          path="/catalog/:slug"
          element={<PublicLayout><ProtectedRoute><CategoryPage /></ProtectedRoute></PublicLayout>}
        />
        <Route
          path="/product/:id"
          element={<PublicLayout><ProtectedRoute><ProductDetail /></ProtectedRoute></PublicLayout>}
        />
        <Route
          path="/quote"
          element={<PublicLayout><ProtectedRoute><QuoteRequest /></ProtectedRoute></PublicLayout>}
        />
        <Route path="/partner" element={<PublicLayout><Partner /></PublicLayout>} />
        <Route path="/confiance" element={<PublicLayout><Trust /></PublicLayout>} />
        <Route path="/comment-ca-marche" element={<PublicLayout><HowItWorks /></PublicLayout>} />
        <Route
          path="/sample"
          element={<PublicLayout><ProtectedRoute><SampleRequest /></ProtectedRoute></PublicLayout>}
        />
        <Route
          path="/brand/:slug"
          element={<PublicLayout><ProtectedRoute><BrandPage /></ProtectedRoute></PublicLayout>}
        />

        <Route
          path="/admin/login"
          element={<AdminLogin isLoggedIn={isLoggedIn} onLogin={() => setIsLoggedIn(true)} />}
        />
        <Route
          path="/admin"
          element={<AdminLayout isLoggedIn={isLoggedIn} onLogout={() => setIsLoggedIn(false)} />}
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="categories" element={<Categories />} />
          <Route path="products" element={<Products />} />
          <Route path="brands" element={<Brands />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="quotes" element={<Quotes />} />
          <Route path="partners" element={<Partners />} />
          <Route path="buyers" element={<Buyers />} />
          <Route path="sources" element={<Sources />} />
          <Route path="data-quality" element={<DataQuality />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<PublicLayout><NotFound /></PublicLayout>} />
      </Routes>
      </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
