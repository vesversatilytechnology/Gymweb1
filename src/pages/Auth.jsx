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
  const [aba, setAba] = useState("login");
  const [mensagemErro, setMensagemErro] = useState("");
  const [mensagemSucesso, setMensagemSucesso] = useState("");
  const navigate = useNavigate();

  const limparMensagens = () => {
    setMensagemErro("");
    setMensagemSucesso("");
  };

  const handleLogin = async () => {
    limparMensagens();
    try {
      await signInWithEmailAndPassword(auth, email, senha);
      navigate("/treinos");
    } catch (error) {
      if (
        error.code === "auth/user-not-found" ||
        error.code === "auth/wrong-password"
      ) {
        setMensagemErro("E-mail ou senha incorretos.");
      } else if (error.code === "auth/invalid-email") {
        setMensagemErro("Formato de e-mail inválido.");
      }
    }
  };

  const handleCadastro = async () => {
    limparMensagens();
    try {
      await createUserWithEmailAndPassword(auth, email, senha);
      setMensagemSucesso("Cadastro realizado com sucesso!");
      setTimeout(() => {
        setAba("login");
      }, 1500);
    } catch (error) {
      if (error.code === "auth/email-already-in-use") {
        setMensagemErro("Este e-mail já está cadastrado.");
      } else if (error.code === "auth/invalid-email") {
        setMensagemErro("Formato de e-mail inválido.");
      } else if (error.code === "auth/weak-password") {
        setMensagemErro("A senha deve ter pelo menos 6 caracteres.");
      }
    }
  };

  const handleRecuperarSenha = async () => {
    limparMensagens();
    try {
      await sendPasswordResetEmail(auth, email);
      setMensagemSucesso("Link de redefinição enviado para o e-mail!");
      setTimeout(() => {
        setAba("login");
      }, 1500);
    } catch (error) {
      if (error.code === "auth/user-not-found") {
        setMensagemErro("Nenhuma conta encontrada com este e-mail.");
      } else if (error.code === "auth/invalid-email") {
        setMensagemErro("Formato de e-mail inválido.");
      }
    }
  };

  const renderFormulario = () => (
    <div className="flex flex-col gap-2 w-full max-w-sm">
      {(aba !== "recuperar") && (
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
        className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
      >
        {aba === "login"
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