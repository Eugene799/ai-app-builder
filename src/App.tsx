import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import Builder from "./pages/builder";
import History from "./pages/history";
import Deploy from "./pages/deploy";
import AuthPage from "./pages/auth";
import ConnectorsPage from "./pages/connectors";
import { AuthProvider, useAuth } from "./hooks/use-auth";
import { Toaster } from "@/components/ui/sonner";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Loading...</div>;
  if (!user) return <Navigate to="/auth" />;
  
  return <>{children}</>;
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/" element={<ProtectedRoute><Builder /></ProtectedRoute>} />
            <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
            <Route path="/deploy/:id" element={<ProtectedRoute><Deploy /></ProtectedRoute>} />
            <Route path="/connectors" element={<ProtectedRoute><ConnectorsPage /></ProtectedRoute>} />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  );
}
