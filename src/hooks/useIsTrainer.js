import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

export default function useIsTrainer() {
  const [isTrainer, setIsTrainer] = useState(false);
  const [loadingRole, setLoadingRole] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          setIsTrainer(false);
          setLoadingRole(false);
          return;
        }
        const snap = await getDoc(doc(db, "userRoles", user.uid));
        const role = snap.exists() ? snap.data().role : null;
        setIsTrainer(role === "trainer");
      } catch (e) {
        console.error("Erro lendo papel do usuário:", e);
        setIsTrainer(false);
      } finally {
        setLoadingRole(false);
      }
    })();
  }, []);

  return { isTrainer, loadingRole };
}