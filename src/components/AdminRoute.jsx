import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { Navigate } from "react-router-dom";
import { ADMIN_MASTER_EMAIL } from "../config";

/**
 * Uso:
 * <AdminRoute><AdminAlunos /></AdminRoute>                // exige ser trainer
 * <AdminRoute masterOnly><AdminConsole /></AdminRoute>    // exige ser MASTER
 */
export default function AdminRoute({ children, masterOnly = false }) {
  const [estado, setEstado] = useState({ carregando: true, autorizado: false });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setEstado({ carregando: false, autorizado: false });
        return;
      }

      // MASTER por e-mail
      const isMaster = (user.email || "").toLowerCase() === ADMIN_MASTER_EMAIL.toLowerCase();
      if (masterOnly) {
        setEstado({ carregando: false, autorizado: isMaster });
        return;
      }

      // Trainer comum: checa userRoles/{uid}.role === "trainer"
      try {
        const r = await getDoc(doc(db, "userRoles", user.uid));
        const isTrainer = r.exists() && r.data()?.role === "trainer";
        setEstado({ carregando: false, autorizado: isTrainer || isMaster });
      } catch {
        setEstado({ carregando: false, autorizado: isMaster });
      }
    });
    return () => unsub();
  }, [masterOnly]);

  if (estado.carregando) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        Verificando permissões…
      </div>
    );
  }

  if (!estado.autorizado) return <Navigate to="/" replace />;

  return children;
}