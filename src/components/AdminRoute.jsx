import { Navigate } from "react-router-dom";
import useIsTrainer from "../hooks/useIsTrainer";

export default function AdminRoute({ children }) {
  const { isTrainer, loadingRole } = useIsTrainer();

  if (loadingRole) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        Carregando…
      </div>
    );
  }

  if (!isTrainer) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}