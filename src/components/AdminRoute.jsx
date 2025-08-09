import { Navigate } from "react-router-dom";
import useIsTrainer from "../hooks/useIsTrainer";

function FullScreenLoading() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      Verificando acesso…
    </div>
  );
}

export default function AdminRoute({ children }) {
  const { user, isTrainer, loadingAuth, loadingRole } = useIsTrainer();

  if (loadingAuth || loadingRole) return <FullScreenLoading />;
  if (!user) return <Navigate to="/" replace />;
  if (!isTrainer) return <Navigate to="/home" replace />;

  return children;
}