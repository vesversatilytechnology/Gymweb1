import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

/** Retorna { user, role: "trainer"|"student"|null, profile, loading } */
export default function useSession() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setRole(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      const [roleSnap, profileSnap] = await Promise.all([
        getDoc(doc(db, "userRoles", u.uid)),
        getDoc(doc(db, "profiles", u.uid)),
      ]);

      const roleValue = roleSnap.exists()
        ? String(roleSnap.data()?.role || "student").toLowerCase()
        : "student";

      setRole(roleValue);
      setProfile(profileSnap.exists() ? profileSnap.data() : null);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { user, role, profile, loading };
}
