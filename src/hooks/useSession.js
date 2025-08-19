// src/hooks/useSession.js
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";

/** Retorna { user, role: "trainer"|"student"|null, profile, loading } */
export default function useSession() {
  const [user, setUser] = useState(() => auth.currentUser);
  const [role, setRole] = useState(null);
  const [profile, setProfile] = useState(null);

  // carregamento controlado por "duas metades": role e profile
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const loading = !(roleLoaded && profileLoaded);

  useEffect(() => {
    let unsubRole = null;
    let unsubProfile = null;

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);

      // limpa listeners antigos
      unsubRole?.();
      unsubProfile?.();

      if (!u) {
        setRole(null);
        setProfile(null);
        setRoleLoaded(true);
        setProfileLoaded(true);
        return;
      }

      // preparando para carregar novamente
      setRoleLoaded(false);
      setProfileLoaded(false);

      // ROLE: default "student" se não existir / erro
      unsubRole = onSnapshot(
        doc(db, "userRoles", u.uid),
        (snap) => {
          const value = snap.exists()
            ? String(snap.data()?.role || "student").toLowerCase()
            : "student";
          setRole(value);
          setRoleLoaded(true);
        },
        (err) => {
          console.warn("[useSession] userRoles onSnapshot:", err?.message || err);
          setRole("student");
          setRoleLoaded(true);
        }
      );

      // PROFILE: atualiza ao vivo (foto, nome, etc.)
      unsubProfile = onSnapshot(
        doc(db, "profiles", u.uid),
        (snap) => {
          setProfile(snap.exists() ? snap.data() : null);
          setProfileLoaded(true);
        },
        (err) => {
          console.warn("[useSession] profiles onSnapshot:", err?.message || err);
          setProfile(null);
          setProfileLoaded(true);
        }
      );
    });

    return () => {
      unsubAuth();
      unsubRole?.();
      unsubProfile?.();
    };
  }, []);

  return { user, role, profile, loading };
}