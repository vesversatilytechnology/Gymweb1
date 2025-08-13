import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Auth from "./pages/Auth";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import AdminAlunos from "./pages/AdminAlunos";
import AdminCatalog from "./pages/AdminCatalog";
import AdminTreinos from "./pages/AdminTreinos";
import AdminRoute from "./components/AdminRoute";
import Timer from "./pages/Timer";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* público */}
        <Route path="/" element={<Auth />} />
        <Route path="/home" element={<Home />} />

        {/* aluno */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/timer" element={<Timer />} />

        {/* treinador */}
        <Route
          path="/admin/alunos"
          element={
            <AdminRoute>
              <AdminAlunos />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/catalog"
          element={
            <AdminRoute>
              <AdminCatalog />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/treinos/:uid"
          element={
            <AdminRoute>
              <AdminTreinos />
            </AdminRoute>
          }
        />

        {/* fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}