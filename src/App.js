import { BrowserRouter, Routes, Route } from "react-router-dom";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import AdminCatalog from "./pages/AdminCatalog";
import AdminTreinos from "./pages/AdminTreinos";
import AdminRoute from "./components/AdminRoute"; // protege rotas de admin

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Login / Registro */}
        <Route path="/" element={<Auth />} />

        {/* Dashboard normal */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Rotas protegidas para treinador */}
        <Route
          path="/admin/catalog"
          element={
            <AdminRoute>
              <AdminCatalog />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/treinos"
          element={
            <AdminRoute>
              <AdminTreinos />
            </AdminRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;