import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [aba, setAba] = useState("login"); // 'login' | 'cadastro' | 'recuperar'
  const [mensagemErro, setMensagemErro] = useState("");
  const [mensagemSucesso, setMensagemSucesso] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const limparMensagens = () => {
    setMensagemErro("");
    setMensagemSucesso("");
  };

  // Validação front
  const emailValido = (e) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || "").trim());

  const mapearErro = (code, contexto) => {
    // contexto: 'login' | 'cadastro' | 'recuperar'
    const comuns = {
      "auth/invalid-email": "Formato de e-mail inválido.",
      "auth/too-many-requests": "Muitas tentativas. Tente novamente mais tarde.",
      "auth/network-request-failed": "Falha de rede. Verifique sua conexão.",
    };

    const porContexto = {
      login: {
        "auth/user-not-found": "E-mail ou senha incorretos.",
        "auth/wrong-password": "E-mail ou senha incorretos.",
        "auth/invalid-credential": "Credencial inválida. Verifique os dados.",
      },
      cadastro: {
        "auth/email-already-in-use": "Este e-mail já está cadastrado.",
        "auth/weak-password": "A senha deve ter pelo menos 6 caracteres.",
      },
      recuperar: {
        "auth/user-not-found": "Nenhuma conta encontrada com este e-mail.",
      },
    };

    // ordem: específicos do contexto → comuns → fallback
    return (
      porContexto[contexto]?.[code] ||
      comuns[code] ||
      "Ocorreu um erro inesperado. Tente novamente."
    );
  };

  const handleLogin = async () => {
    limparMensagens();

    if (!emailValido(email)) {
      setMensagemErro("Informe um e-mail válido.");
      return;
    }
    if (!senha) {
      setMensagemErro("Informe sua senha.");
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), senha);
      navigate("/dashboard");
    } catch (error) {
      setMensagemErro(mapearErro(error.code, "login"));
    } finally {
      setLoading(false);
    }
  };

  const handleCadastro = async () => {
    limparMensagens();

    if (!emailValido(email)) {
      setMensagemErro("Formato de e-mail inválido.");
      return;
    }
    if ((senha || "").length < 6) {
      setMensagemErro("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email.trim(), senha);
      setMensagemSucesso("Cadastro realizado com sucesso!");
      setTimeout(() => {
        setAba("login");
      }, 1500);
    } catch (error) {
      setMensagemErro(mapearErro(error.code, "cadastro"));
    } finally {
      setLoading(false);
    }
  };

  const handleRecuperarSenha = async () => {
    limparMensagens();

    if (!emailValido(email)) {
      setMensagemErro("Informe um e-mail válido para recuperação.");
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMensagemSucesso("Link de redefinição enviado para o e-mail!");
      setTimeout(() => {
        setAba("login");
      }, 1500);
    } catch (error) {
      setMensagemErro(mapearErro(error.code, "recuperar"));
    } finally {
      setLoading(false);
    }
  };

  const renderFormulario = () => (
    <div className="flex flex-col gap-2 w-full max-w-sm">
      {aba !== "recuperar" && (
        <>
          <input
            type="email"
            placeholder="E-mail"
            className="border border-gray-300 p-2 rounded"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Senha"
            className="border border-gray-300 p-2 rounded"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </>
      )}

      {aba === "recuperar" && (
        <input
          type="email"
          placeholder="E-mail cadastrado"
          className="border border-gray-300 p-2 rounded"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      )}

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
        {loading
          ? "Aguarde..."
          : aba === "login"
          ? "Entrar"
          : aba === "cadastro"
          ? "Cadastrar"
          : "Enviar link"}
      </button>

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
    <div className="flex justify-center items-center h-screen bg-gray-900 p-4">
      {renderFormulario()}
    </div>
  );
}