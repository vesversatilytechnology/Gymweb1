import { useState } from "react";
import { db } from "../firebase";
import { collection, addDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import useIsTrainer from "../hooks/useIsTrainer";

export default function AdminCatalog() {
  const [nome, setNome] = useState("");
  const [grupo, setGrupo] = useState("Costas");
  const [videoId, setVideoId] = useState("");
  const [mensagem, setMensagem] = useState("");
  const navigate = useNavigate();

  // Lê do Firestore se o usuário atual tem role=trainer
  const { isTrainer, loadingRole } = useIsTrainer();

  const handleSalvar = async () => {
    setMensagem("");

    if (!isTrainer) {
      setMensagem("Acesso restrito ao treinador.");
      return;
    }
    if (!nome.trim() || !videoId.trim()) {
      setMensagem("Preencha nome e videoId.");
      return;
    }

    try {
      await addDoc(collection(db, "catalogoExercicios"), {
        nome: nome.trim(),
        grupo,
        videoId: videoId.trim(),
      });
      setMensagem("Exercício cadastrado no catálogo!");
      setNome("");
      setVideoId("");
    } catch (e) {
      console.error(e);
      setMensagem("Erro ao salvar. Veja o console.");
    }
  };

  if (loadingRole) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        Verificando acesso…
      </div>
    );
  }

  if (!isTrainer) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <div className="max-w-xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">Catálogo de Exercícios</h1>
          <div className="bg-gray-800 p-4 rounded">
            Acesso restrito ao treinador.
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className="mt-4 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
          >
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Catálogo de Exercícios</h1>

        <div className="bg-gray-800 p-4 rounded mb-4">
          <label className="block mb-1">Nome do exercício</label>
          <input
            className="w-full p-2 rounded text-black mb-3"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Puxada alta na polia"
          />

          <label className="block mb-1">Grupo muscular</label>
          <select
            className="w-full p-2 rounded text-black mb-3"
            value={grupo}
            onChange={(e) => setGrupo(e.target.value)}
          >
            <option>Costas</option>
            <option>Panturrilha</option>
            <option>Peito</option>
            <option>Ombros</option>
            <option>Bíceps</option>
            <option>Tríceps</option>
            <option>Pernas</option>
            <option>Glúteos</option>
            <option>Abdômen</option>
            <option>Outros</option>
          </select>

          <label className="block mb-1">YouTube videoId</label>
          <input
            className="w-full p-2 rounded text-black mb-3"
            value={videoId}
            onChange={(e) => setVideoId(e.target.value)}
            placeholder="Ex.: dQw4w9WgXcQ"
          />

          <button
            onClick={handleSalvar}
            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded"
          >
            Salvar no catálogo
          </button>
        </div>

        {mensagem && <div className="bg-gray-800 p-3 rounded">{mensagem}</div>}

        <button
          onClick={() => navigate("/dashboard")}
          className="mt-4 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
        >
          Voltar ao Dashboard
        </button>
      </div>
    </div>
  );
}