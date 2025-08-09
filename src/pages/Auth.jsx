import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
} from "firebase/auth";
import { auth, db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";

export default function Auth() {
  const [aba, setAba] = useState("login"); // 'login' | 'cadastro' | 'recuperar'
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState(""); // usado no cadastro
  const [mensagemErro, setMensagemErro] = useState("");
  const [mensagemSucesso, setMensagemSucesso] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const limparMensagens = () => {
    setMensagemErro("");
    setMensagemSucesso("");
  };

  async function redirecionarPorPapel(uid) {
    try {
      const snap = await getDoc(doc(db, "userRoles", uid));
      const role = snap.exists() ? snap.data()?.role : null;
      if (role === "trainer") {
        navigate("/admin/alunos", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (e) {
      console.error("Erro checando role:", e);
      // fallback: manda para dashboard
      navigate("/dashboard", { replace: true });
    }
  }

  const handleLogin = async () => {
    limparMensagens();
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), senha);
      await redirecionarPorPapel(cred.user.uid);
    } catch (error) {
      // NÃO troca de aba — apenas mostra mensagem
      if (
        error.code === "auth/user-not-found" ||
        error.code === "auth/wrong-password"
      ) {
        setMensagemErro("E‑mail ou senha incorretos.");
      } else if (error.code === "auth/invalid-email") {
        setMensagemErro("Formato de e‑mail inválido.");
      } else if (error.code === "auth/invalid-api-key" || error.code === "auth/api-key-not-valid") {
        setMensagemErro("Chave da API inválida. Verifique o arquivo firebase.js.");
      } else {
        setMensagemErro("Não foi possível entrar. Tente novamente.");
        console.error(error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCadastro = async () => {
    limparMensagens();
    setLoading(true);
    try {
      if (!nome.trim()) {
        setMensagemErro("Informe seu nome completo.");
        setLoading(false);
        return;
      }
      const cred = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        senha
      );

      // Atualiza displayName (opcional)
      try {
        await updateProfile(cred.user, { displayName: nome.trim() });
      } catch (_) {}

      // Salva perfil em profiles/{uid}
      await setDoc(doc(db, "profiles", cred.user.uid), {
        uid: cred.user.uid,
        nome: nome.trim(),
        nomeLower: nome.trim().toLowerCase(),
        email: cred.user.email,
        emailLower: cred.user.email.toLowerCase(),
        apelido: "",
        criadoEm: new Date(),
      });

      setMensagemSucesso("Cadastro realizado! Faça login para continuar.");
      // volta para a aba de login, mas só depois de mostrar a mensagem
      setTimeout(() => {
        setAba("login");
        setMensagemSucesso("");
      }, 1200);
    } catch (error) {
      if (error.code === "auth/email-already-in-use") {
        setMensagemErro("Este e‑mail já está cadastrado.");
      } else if (error.code === "auth/invalid-email") {
        setMensagemErro("Formato de e‑mail inválido.");
      } else if (error.code === "auth/weak-password") {
        setMensagemErro("A senha deve ter pelo menos 6 caracteres.");
      } else {
        setMensagemErro("Não foi possível cadastrar. Tente novamente.");
        console.error(error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRecuperarSenha = async () => {
    limparMensagens();
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMensagemSucesso("Link de redefinição enviado para o e‑mail.");
      setTimeout(() => {
        setAba("login");
        setMensagemSucesso("");
      }, 1200);
    } catch (error) {
      if (error.code === "auth/user-not-found") {
        setMensagemErro("Nenhuma conta encontrada com este e‑mail.");
      } else if (error.code === "auth/invalid-email") {
        setMensagemErro("Formato de e‑mail inválido.");
      } else {
        setMensagemErro("Não foi possível enviar o link. Tente novamente.");
        console.error(error);
      }
    } finally {
      setLoading(false);
    }
  };

  const renderFormulario = () => (
    <div className="flex flex-col gap-2 w-full max-w-sm">
      {/* Campos */}
      {aba === "cadastro" && (
        <input
          type="text"
          placeholder="Nome completo"
          className="border border-gray-300 p-2 rounded"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
      )}

      {(aba === "login" || aba === "cadastro" || aba === "recuperar") && (
        <input
          type="email"
          placeholder="E‑mail"
          className="border border-gray-300 p-2 rounded"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      )}

      {(aba === "login" || aba === "cadastro") && (
        <input
          type="password"
          placeholder="Senha"
          className="border border-gray-300 p-2 rounded"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
      )}

      {/* Mensagens */}
      {mensagemErro && (
        <div className="bg-red-100 text-red-700 p-2 rounded text-sm">
          {mensagemErro}
        </div>
      )}
      {mensagemSucesso && (
        <div className="bg-green-100 text-green-700 p-2 rounded text-sm">
          {mensagemSucesso}
        </div>
      )}

      {/* Botão principal */}
      <button
        onClick={
          aba === "login"
            ? handleLogin
            : aba === "cadastro"
            ? handleCadastro
            : handleRecuperarSenha
        }
        disabled={loading}
        className={`${
          loading ? "opacity-70 cursor-not-allowed" : ""
        } bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700`}
      >
        {aba === "login"
          ? loading ? "Entrando…" : "Entrar"
          : aba === "cadastro"
          ? loading ? "Cadastrando…" : "Cadastrar"
          : loading ? "Enviando…" : "Enviar link"}
      </button>

      {/* Troca de abas */}
      <div className="flex justify-between text-sm text-blue-600 mt-2">
        {aba !== "login" && (
          <button
            onClick={() => {
              limparMensagens();
              setAba("login");
            }}
          >
            Já tenho cadastro
          </button>
        )}
        {aba !== "cadastro" && (
          <button
            onClick={() => {
              limparMensagens();
              setAba("cadastro");
            }}
          >
            Fazer cadastro
          </button>
        )}
        {aba !== "recuperar" && (
          <button
            onClick={() => {
              limparMensagens();
              setAba("recuperar");
            }}
          >
            Esqueci minha senha
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-900 p-4">
      {renderFormulario()}
    </div>
  );
}