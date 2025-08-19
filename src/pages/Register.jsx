// src/pages/Register.jsx
import { useState } from "react";
import { createUserWithEmailAndPassword, deleteUser } from "firebase/auth";
import { auth, db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

export default function Register() {
  const [nome, setNome]   = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [msg, setMsg]     = useState("");
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setMsg("");

    if (!nome.trim()) { setMsg("Informe seu nome."); return; }

    let step = "init";
    let user;

    try {
      // 1) Cria usuário no Auth
      step = "auth:create";
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), senha);
      user = cred.user;

      // 🔐 garante token carregado pro Firestore
      await user.getIdToken(true);

      const uid = user.uid;

      // 2) Escreve perfil no Firestore
      step = "firestore:profiles:set";
      await setDoc(doc(db, "profiles", uid), {
        uid,
        nome: nome.trim(),
        nomeLower: nome.trim().toLowerCase(),
        email: email.trim(),
        emailLower: email.trim().toLowerCase(),
        criadoEm: serverTimestamp(),
      });

      // 3) userRoles (NÃO BLOQUEIA cadastro se falhar)
      try {
        step = "firestore:userRoles:probe";
        const roleRef  = doc(db, "userRoles", uid);
        const roleSnap = await getDoc(roleRef); // permitido ler o próprio doc pelas suas regras

        if (!roleSnap.exists()) {
          step = "firestore:userRoles:create";
          await setDoc(roleRef, { role: "student" }); // CREATE -> permitido pelas suas regras
        } else {
          step = "firestore:userRoles:skip-update"; // já existe -> não tenta atualizar
        }
      } catch (roleErr) {
        console.warn(`[userRoles] Ignorado. step=${step}`, roleErr);
      }

      setMsg("Cadastro realizado! Faça login.");
      setTimeout(() => navigate("/"), 1000);

    } catch (err) {
      console.error(`[Register] Falhou em step=${step}`, err);

      // se falhou ao gravar perfil, desfaz usuário recém-criado
      if (user && step.startsWith("firestore:profiles")) {
        try { await deleteUser(user); } catch {}
      }

      const code = err.code || "";
      const perm = err.message?.includes("Missing or insufficient permissions");
      const map = {
        "auth/email-already-in-use": "Email já cadastrado.",
        "auth/invalid-email": "Email inválido.",
        "auth/weak-password": "Senha muito fraca (mín. 6).",
      };
      setMsg(map[code] || (perm ? "Sem permissão no Firestore (regras/ambiente)." : `Erro ao registrar (${step}).`));
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
      <h1 className="text-3xl mb-6">Cadastro</h1>
      <form onSubmit={handleRegister} className="flex flex-col gap-4 w-72">
        <input type="text" placeholder="Nome completo" className="p-2 rounded text-black"
               value={nome} onChange={(e) => setNome(e.target.value)} required />
        <input type="email" placeholder="Email" className="p-2 rounded text-black"
               value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Senha" className="p-2 rounded text-black"
               value={senha} onChange={(e) => setSenha(e.target.value)} required />
        <button type="submit" className="bg-blue-600 p-2 rounded">Cadastrar</button>
      </form>
      {msg && <div className="mt-3 text-yellow-300">{msg}</div>}
    </div>
  );
}
