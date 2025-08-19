// src/components/SideMenu.jsx
import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import useSession from "../hooks/useSession";

function Icon({ d, className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d={d} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function SideMenu() {
  const [open, setOpen] = useState(false);
  const [imgError, setImgError] = useState(false); // 👈 mover para cima resolve a regra
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, role, profile } = useSession() || {};

  const shouldShow = !!user && pathname !== "/";

  useEffect(() => {
    if (!shouldShow || !open) return;
    const onEsc = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, shouldShow]);

  useEffect(() => {
    if (!shouldShow) return;
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, shouldShow]);

  if (!shouldShow) return null; // ✅ agora não há hooks depois deste return

  const name = profile?.nome || user?.displayName || user?.email || "Usuário";
  const avatarUrl = !imgError ? (profile?.photoUrl || user?.photoURL || "") : "";
  const fallbackLetter = (name?.trim()?.[0] || "U").toUpperCase();

  const commonItems = [
    { to: "/home", label: "Início", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a2 2 0 002 2h10a2 2 0 002-2V10" },
  ];
  const alunoItems = [
    { to: "/profile", label: "Perfil", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zm6 13a8 8 0 10-16 0h16z" },
    { to: "/dashboard", label: "Exercícios", icon: "M6 12h12M6 8h12M6 16h8" },
    { to: "/ficha-biometrica", label: "Ficha biométrica", icon: "M4 7h16M4 17h16M7 7v10M17 7v10" },
    { to: "/pagamentos", label: "Pagamentos", icon: "M3 10h18M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z" },
  ];
  const adminItems = [
    { to: "/admin/alunos", label: "Alunos", icon: "M16 11V7a4 4 0 10-8 0v4M5 20h14a2 2 0 002-2v-6H3v6a2 2 0 002 2z" },
    { to: "/admin/catalog", label: "Gerenciar exercícios", icon: "M12 6v12m6-6H6" },
    { to: "/admin/treinos/uid-exemplo", label: "Treinos (atalho)", icon: "M9 12l2 2 4-4" },
  ];
  const items = role === "trainer" ? [...commonItems, ...alunoItems, ...adminItems] : [...commonItems, ...alunoItems];

  const handleLogout = async () => {
    await signOut(auth);
    setOpen(false);
    navigate("/");
  };

  const NavItem = ({ to, label, icon }) => (
    <Link
      to={to}
      onClick={() => setOpen(false)}
      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10"
    >
      <Icon d={icon} />
      <span>{label}</span>
    </Link>
  );

  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir menu"
        className="fixed z-50 flex items-center justify-center rounded-full shadow-lg bg-indigo-600 text-white hover:bg-indigo-500
                  w-11 h-11 p-2 sm:w-12 sm:h-12 sm:p-3
                  left-[calc(env(safe-area-inset-left,0px)+12px)]
                  top-[calc(env(safe-area-inset-top,0px)+12px)]"
        style={{
          left: "max(1rem, env(safe-area-inset-left, 0px))",
          top: "max(1rem, env(safe-area-inset-top, 0px))",
        }}
      >
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Overlay */}
      {open && (
        <button
          aria-label="Fechar"
          onClick={() => setOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-[1px] z-40"
        />
      )}

      {/* Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 w-80 max-w-[85vw] z-50 border-r border-white/10
                    bg-slate-900/95 text-slate-100 backdrop-blur transform transition-transform duration-300
                    ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* header com perfil */}
        <div className="p-5 pb-4 border-b border-white/10 flex items-center gap-4 pt-safe">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Foto"
              className="w-12 h-12 rounded-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold">
              {fallbackLetter}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold truncate">{name}</p>
            {role && <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded bg-white/10">{role}</span>}
          </div>
        </div>

        {/* itens */}
        <nav className="p-3 space-y-1">
          {items.map((i) => (
            <NavItem key={i.to} {...i} />
          ))}
        </nav>

        {/* sair */}
        <div className="mt-auto p-3 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500"
          >
            <Icon d="M15 12H3m12 0l-4-4m4 4l-4 4M21 4v16" />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}
