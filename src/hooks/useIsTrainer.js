import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

export default function useIsTrainer() {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [isTrainer, setIsTrainer] = useState(false);
  const [loadingRole, setLoadingRole] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoadingAuth(false);

      if (!u) {
        setIsTrainer(false);
        setLoadingRole(false);
        return;
      }

      setLoadingRole(true);
      try {
        const snap = await getDoc(doc(db, "userRoles", u.uid));
        setIsTrainer(snap.exists() && snap.data()?.role === "trainer");
      } catch (e) {
        console.error("useIsTrainer role error:", e);
        setIsTrainer(false);
      } finally {
        setLoadingRole(false);
      }
    });

    return () => unsub();
  }, []);

  return { user, isTrainer, loadingAuth, loadingRole };
}