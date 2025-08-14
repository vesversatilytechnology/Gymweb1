import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Auth from "./pages/Auth";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import AdminAlunos from "./pages/AdminAlunos";
import AdminCatalog from "./pages/AdminCatalog";
import AdminTreinos from "./pages/AdminTreinos";
import AdminRoute from "./components/AdminRoute";
import SideMenu from "./components/SideMenu";
import Timer from "./pages/Timer";
import Profile from "./pages/Profile";

export default function App() {
  return (
    <BrowserRouter>
      <SideMenu />  {/* <-- novo: aparece em todas as telas logadas */}
      <Routes>
        {/* público */}
        <Route path="/" element={<Auth />} />
        <Route path="/home" element={<Home />} />

        {/* aluno */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/timer" element={<Timer />} />
         <Route path="/profile" element={<Profile />} />

        {/* placeholders (aluno) */}
        <Route path="/ficha-biometrica" element={<div className="p-6 text-white">Ficha biométrica (em breve)</div>} />
        <Route path="/pagamentos" element={<div className="p-6 text-white">Pagamentos (em breve)</div>} />

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