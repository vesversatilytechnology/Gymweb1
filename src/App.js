import { BrowserRouter, Routes, Route } from "react-router-dom";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import AdminCatalog from "./pages/AdminCatalog";
import AdminTreinos from "./pages/AdminTreinos";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Auth />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin/catalog" element={<AdminCatalog />} />
        <Route path="/admin/treinos" element={<AdminTreinos />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;