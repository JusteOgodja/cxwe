import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { AuthProvider } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Catalog from './pages/Catalog';
import CategoryPage from './pages/CategoryPage';
import QuoteRequest from './pages/QuoteRequest';
import ProductDetail from './pages/ProductDetail';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import AdminLogin from './pages/admin/AdminLogin';
import AdminLayout from './pages/admin/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import Categories from './pages/admin/Categories';
import Products from './pages/admin/Products';
import Brands from './pages/admin/Brands';
import Suppliers from './pages/admin/Suppliers';
import Quotes from './pages/admin/Quotes';
import Partners from './pages/admin/Partners';
import Partner from './pages/Partner';
import Trust from './pages/Trust';
import BrandPage from './pages/BrandPage';

function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(!!data.session);
      setAuthChecked(true);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });
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
        <Route
          path="/brand/:slug"
          element={<PublicLayout><ProtectedRoute><BrandPage /></ProtectedRoute></PublicLayout>}
        />

        <Route
          path="/admin"
          element={<AdminLogin isLoggedIn={isLoggedIn} onLogin={() => setIsLoggedIn(true)} />}
        />
        <Route
          path="/admin"
          element={<AdminLayout isLoggedIn={isLoggedIn} onLogout={() => setIsLoggedIn(false)} />}
        >
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="categories" element={<Categories />} />
          <Route path="products" element={<Products />} />
          <Route path="brands" element={<Brands />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="quotes" element={<Quotes />} />
          <Route path="partners" element={<Partners />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
