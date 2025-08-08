import { useState } from "react";
import { db } from "../firebase";
import { collection, addDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import useIsTrainer from "../hooks/useIsTrainer";

export default function AdminTreinos() {
  const navigate = useNavigate();
  const { isTrainer, loadingRole } = useIsTrainer();

  const [alunoUid, setAlunoUid] = useState("");
  const [titulo, setTitulo] = useState("Treino A");
  const [descricao, setDescricao] = useState("");
  const [exercicios, setExercicios] = useState([
    { nome: "", series: "", videoId: "", grupo: "Outros", ordem: 1 },
  ]);
  const [mensagem, setMensagem] = useState("");

  const addLinha = () =>
    setExercicios((prev) => [
      ...prev,
      { nome: "", series: "", videoId: "", grupo: "Outros", ordem: prev.length + 1 },
    ]);

  const rmLinha = (i) =>
    setExercicios((prev) => prev.filter((_, idx) => idx !== i));

  const setCampo = (i, campo, valor) =>
    setExercicios((prev) =>
      prev.map((ex, idx) => (idx === i ? { ...ex, [campo]: valor } : ex))
    );

  const salvar = async () => {
    setMensagem("");

    if (!isTrainer) {
      setMensagem("Acesso restrito ao treinador.");
      return;
    }
    if (!alunoUid.trim()) {
      setMensagem("Informe o UID do aluno.");
      return;
    }
    if (!titulo.trim()) {
      setMensagem("Informe o título do treino.");
      return;
    }
    const validos = exercicios.filter((e) => e.nome && e.series && e.videoId);
    if (validos.length === 0) {
      setMensagem("Adicione ao menos 1 exercício com nome, séries e videoId.");
      return;
    }

    try {
      // Cria o treino no caminho que o Dashboard lê:
      // users/{alunoUid}/treinos/{treinoId}
      const treinosRef = collection(db, "users", alunoUid.trim(), "treinos");
      const treinoDoc = await addDoc(treinosRef, {
        titulo: titulo.trim(),
        descricao: (descricao || "").trim(),
        ordem: 1,
        criadoEm: new Date(),
      });

      // Subcoleção: exercicios
      const exRef = collection(treinoDoc.ref, "exercicios");
      for (const ex of validos) {
        await addDoc(exRef, {
          nome: ex.nome.trim(),
          series: ex.series.trim(),
          videoId: ex.videoId.trim(),
          grupo: ex.grupo || "Outros",
          ordem: Number(ex.ordem) || 1,
          criadoEm: new Date(),
        });
      }

      setMensagem("Treino criado para o aluno!");
      // limpa o formulário
      setAlunoUid("");
      setTitulo("Treino A");
      setDescricao("");
      setExercicios([{ nome: "", series: "", videoId: "", grupo: "Outros", ordem: 1 }]);
    } catch (e) {
      console.error(e);
      setMensagem("Erro ao salvar. Veja o console.");
    }
  };

  if (loadingRole) {
    return <div className="min-h-screen bg-gray-900 text-white p-4">Verificando acesso…</div>;
  }
  if (!isTrainer) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <div className="max-w-3xl mx-auto">Acesso restrito ao treinador.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Criar Treino para Aluno</h1>

        <div className="bg-gray-800 p-4 rounded mb-4">
          <label className="block text-sm mb-1">UID do aluno</label>
          <input
            className="w-full p-2 rounded text-black mb-3"
            value={alunoUid}
            onChange={(e) => setAlunoUid(e.target.value)}
            placeholder="Cole aqui o UID do aluno (Authentication → Users)"
          />

          <label className="block text-sm mb-1">Título do treino</label>
          <input
            className="w-full p-2 rounded text-black mb-3"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />

          <label className="block text-sm mb-1">Descrição</label>
          <textarea
            className="w-full p-2 rounded text-black mb-3"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
        </div>

        <h2 className="text-xl font-semibold mb-2">Exercícios</h2>

        {exercicios.map((ex, i) => (
          <div key={i} className="bg-gray-800 p-3 rounded mb-3">
            <div className="grid md:grid-cols-5 gap-2">
              <div className="md:col-span-2">
                <label className="block text-xs">Nome</label>
                <input
                  className="w-full p-2 rounded text-black"
                  value={ex.nome}
                  onChange={(e) => setCampo(i, "nome", e.target.value)}
                  placeholder="Ex.: Puxada alta"
                />
              </div>
              <div>
                <label className="block text-xs">Séries</label>
                <input
                  className="w-full p-2 rounded text-black"
                  value={ex.series}
                  onChange={(e) => setCampo(i, "series", e.target.value)}
                  placeholder="3x12"
                />
              </div>
              <div>
                <label className="block text-xs">VideoId (YouTube)</label>
                <input
                  className="w-full p-2 rounded text-black"
                  value={ex.videoId}
                  onChange={(e) => setCampo(i, "videoId", e.target.value)}
                  placeholder="dQw4w9WgXcQ"
                />
              </div>
              <div>
                <label className="block text-xs">Grupo</label>
                <select
                  className="w-full p-2 rounded text-black"
                  value={ex.grupo}
                  onChange={(e) => setCampo(i, "grupo", e.target.value)}
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
              </div>
            </div>

            <div className="mt-2 flex items-center gap-3">
              <div>
                <label className="block text-xs">Ordem</label>
                <input
                  type="number"
                  className="w-24 p-2 rounded text-black"
                  value={ex.ordem}
                  onChange={(e) => setCampo(i, "ordem", e.target.value)}
                />
              </div>

              <button
                onClick={() => rmLinha(i)}
                className="mt-6 bg-red-600 hover:bg-red-700 px-3 py-2 rounded text-sm"
              >
                Remover
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={addLinha}
          className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded mb-4"
        >
          + Adicionar exercício
        </button>

        <div className="flex gap-3">
          <button
            onClick={salvar}
            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded"
          >
            Salvar treino
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
          >
            Voltar
          </button>
        </div>

        {mensagem && <div className="mt-3 bg-gray-800 p-2 rounded">{mensagem}</div>}
      </div>
    </div>
  );
}