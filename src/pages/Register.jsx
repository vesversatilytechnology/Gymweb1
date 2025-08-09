import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { doc, setDoc } from "firebase/firestore";

export default function Register() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState("");
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setMsg("");

    if (!nome.trim()) {
      setMsg("Informe seu nome.");
      return;
    }

    try {
      await createUserWithEmailAndPassword(auth, email, senha);

      const uid = auth.currentUser.uid;

      // salva perfil do usuário
      await setDoc(doc(db, "profiles", uid), {
        uid,
        nome: nome.trim(),
        nomeLower: nome.trim().toLowerCase(),
        email: email.trim(),
        emailLower: email.trim().toLowerCase(),
        criadoEm: new Date(),
      });

      // marca como student
      await setDoc(doc(db, "userRoles", uid), { role: "student" }, { merge: true });

      setMsg("Cadastro realizado! Faça login.");
      setTimeout(() => navigate("/"), 1200);
    } catch (error) {
      console.error(error);
      setMsg("Erro ao registrar: " + (error.message || ""));
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
      <h1 className="text-3xl mb-6">Cadastro</h1>
      <form onSubmit={handleRegister} className="flex flex-col gap-4 w-72">
        <input
          type="text"
          placeholder="Nome completo"
          className="p-2 rounded text-black"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
        />
        <input
          type="email"
          placeholder="Email"
          className="p-2 rounded text-black"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Senha"
          className="p-2 rounded text-black"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
        />
        <button type="submit" className="bg-blue-600 p-2 rounded">
          Cadastrar
        </button>
      </form>

      {msg && <div className="mt-3 text-yellow-300">{msg}</div>}
    </div>
  );
}