import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";              // você já tem
import AdminCatalog from "./pages/AdminCatalog"; // se usa
import AdminTreinos from "./pages/AdminTreinos";
import AdminAlunos from "./pages/AdminAlunos";

import AdminRoute from "./components/AdminRoute";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Público / aluno */}
        <Route path="/" element={<Auth />} />
        <Route path="/home" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Admin: lista de alunos */}
        <Route
          path="/admin/alunos"
          element={
            <AdminRoute>
              <AdminAlunos />
            </AdminRoute>
          }
        />

        {/* Admin: cadastro de treino para aluno selecionado */}
        <Route
          path="/admin/treinos/:uid"
          element={
            <AdminRoute>
              <AdminTreinos />
            </AdminRoute>
          }
        />

        {/* (opcional) Admin: catálogo de exercícios */}
        <Route
          path="/admin/catalog"
          element={
            <AdminRoute>
              <AdminCatalog />
            </AdminRoute>
          }
        />

        {/* fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}