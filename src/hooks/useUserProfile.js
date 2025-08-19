import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { doc, onSnapshot } from "firebase/firestore";

export function useUserProfile() {
  const [user, setUser] = useState(() => auth.currentUser);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((u) => {
      setUser(u || null);
      if (!u) return setProfile(null);
      return onSnapshot(doc(db, "profiles", u.uid), (snap) => {
        setProfile(snap.exists() ? snap.data() : null);
      });
    });
    return () => unsubAuth();
  }, []);

  const avatar =
    profile?.photoUrl ||
    user?.photoURL ||
    (user?.email
      ? `https://ui-avatars.com/api/?name=${encodeURIComponent(
          user.email
        )}&background=4f46e5&color=fff`
      : "");

  return { user, profile, avatar };
}
