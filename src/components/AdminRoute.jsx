import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { Navigate } from "react-router-dom";
import { ADMIN_MASTER_EMAILS } from "../config";

export default function AdminRoute({ children, masterOnly = false }) {
  const [estado, setEstado] = useState({ carregando: true, autorizado: false });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setEstado({ carregando: false, autorizado: false });
        return;
      }

      const email = (user.email || "").toLowerCase();
      const isMaster = ADMIN_MASTER_EMAILS.includes(email);

      if (masterOnly) {
        setEstado({ carregando: false, autorizado: isMaster });
        return;
      }

      try {
        const r = await getDoc(doc(db, "userRoles", user.uid));
        const role = (r.exists() ? (r.data()?.role || "") : "").toLowerCase();
        const isTrainer = role === "trainer";
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