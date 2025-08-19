// src/pages/ChangePassword.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { auth } from "../firebase";

export default function ChangePassword() {
  const navigate = useNavigate();
  const user = auth.currentUser;

  const [curr, setCurr] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState({ c: false, n: false, f: false });

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");       // sucesso
  const [err, setErr] = useState("");       // erro

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");

    if (!user) {
      navigate("/");
      return;
    }
    if (next.length < 6) {
      setErr("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (next !== confirm) {
      setErr("As senhas não conferem.");
      return;
    }

    setSaving(true);
    try {
      // 1) reautentica (necessário para operações sensíveis)
      const cred = EmailAuthProvider.credential(user.email, curr);
      await reauthenticateWithCredential(user, cred);

      // 2) atualiza a senha
      await updatePassword(user, next);

      setMsg("Senha alterada com sucesso!");
      setCurr("");
      setNext("");
      setConfirm("");
    } catch (e) {
      // mensagens amigáveis
      const code = e?.code || "";
      if (code === "auth/wrong-password") setErr("Senha atual incorreta.");
      else if (code === "auth/weak-password") setErr("A nova senha é muito fraca.");
      else if (code === "auth/requires-recent-login")
        setErr("Faça login novamente e tente de novo.");
      else setErr("Não foi possível alterar a senha. Tente novamente.");
      console.warn("[ChangePassword]", e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Alterar senha</h1>
          <Link to="/profile" className="px-3 py-2 rounded bg-gray-700 hover:bg-gray-600">
            Voltar
          </Link>
        </div>

        <form onSubmit={onSubmit} className="bg-gray-800 rounded p-4 space-y-4">
          {err && <div className="bg-red-600/20 border border-red-600 text-red-200 px-3 py-2 rounded">{err}</div>}
          {msg && <div className="bg-emerald-600/20 border border-emerald-600 text-emerald-200 px-3 py-2 rounded">{msg}</div>}

          <div>
            <label className="text-sm text-gray-300">Senha atual</label>
            <div className="mt-1 flex">
              <input
                type={show.c ? "text" : "password"}
                className="w-full p-2 rounded-l bg-gray-900 border border-gray-700"
                value={curr}
                onChange={(e) => setCurr(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShow((s) => ({ ...s, c: !s.c }))}
                className="px-3 rounded-r bg-gray-700 border border-gray-700"
              >
                {show.c ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-300">Nova senha</label>
            <div className="mt-1 flex">
              <input
                type={show.n ? "text" : "password"}
                className="w-full p-2 rounded-l bg-gray-900 border border-gray-700"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShow((s) => ({ ...s, n: !s.n }))}
                className="px-3 rounded-r bg-gray-700 border border-gray-700"
              >
                {show.n ? "Ocultar" : "Mostrar"}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Mínimo de 6 caracteres.</p>
          </div>

          <div>
            <label className="text-sm text-gray-300">Confirmar nova senha</label>
            <div className="mt-1 flex">
              <input
                type={show.f ? "text" : "password"}
                className="w-full p-2 rounded-l bg-gray-900 border border-gray-700"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShow((s) => ({ ...s, f: !s.f }))}
                className="px-3 rounded-r bg-gray-700 border border-gray-700"
              >
                {show.f ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar nova senha"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
