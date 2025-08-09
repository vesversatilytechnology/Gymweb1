import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";
import useIsTrainer from "../hooks/useIsTrainer";

export default function AdminTreinos() {
  const { uid } = useParams(); // uid do aluno
  const navigate = useNavigate();
  const { isTrainer, loadingRole } = useIsTrainer();

  // ----- Aluno -----
  const [aluno, setAluno] = useState(null); // { uid, nome, email, apelido }
  const [carregandoAluno, setCarregandoAluno] = useState(true);

  // ----- Lista de treinos do aluno -----
  const [treinos, setTreinos] = useState([]); // [{id, titulo, descricao, ordem, criadoEm}]
  const [carregandoTreinos, setCarregandoTreinos] = useState(true);

   // -----Treino selecionado (edição) -----
  const [treinoId, setTreinoId] = useState("novo"); // "novo" | id existente

  // ----- Form do treino -----
  const [titulo, setTitulo] = useState("Treino A");
  const [descricao, setDescricao] = useState("");

  // ----- Exercícios do treino (edição) -----
  // cada item: { id? (se existente), nome, series, videoId, grupo, ordem }
  const [exercicios, setExercicios] = useState([
    { nome: "", series: "3x12", videoId: "", grupo: "Outros", ordem: 1 },
  ]);
  const [removidos, setRemovidos] = useState([]); // ids de exercícios removidos (para deletar no salvar)

  const [mensagem, setMensagem] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [excluindoTreino, setExcluindoTreino] = useState(false);

  // ===================== Proteção =====================
  useEffect(() => {
    if (!loadingRole && !isTrainer) navigate("/home");
  }, [isTrainer, loadingRole, navigate]);

  // ===================== Carregar aluno =====================
  useEffect(() => {
    const carregarAluno = async () => {
      setCarregandoAluno(true);
      try {
        let dados = null;

        const p = await getDoc(doc(db, "profiles", uid));
        if (p.exists()) {
          const x = p.data();
          dados = {
            uid,
            nome: x.nome || x.nomeCompleto || "",
            email: x.email || "",
            apelido: x.apelido || "",
          };
        } else {
          const u = await getDoc(doc(db, "users", uid));
          if (u.exists()) {
            const x = u.data();
            dados = {
              uid,
              nome: x.nomeCompleto || x.nome || "",
              email: x.email || "",
              apelido: x.apelido || "",
            };
          }
        }

        setAluno(dados);
      } catch (e) {
        console.error("Erro carregando aluno:", e);
      } finally {
        setCarregandoAluno(false);
      }
    };

    if (uid) carregarAluno();
  }, [uid]);

  // ===================== Carregar treinos do aluno =====================
  const carregarTreinos = useCallback(async () => {
  setCarregandoTreinos(true);
  try {
    const ref = collection(db, "users", uid, "treinos");
    const q = query(ref, orderBy("criadoEm", "desc"));
    const snap = await getDocs(q);
    const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setTreinos(lista);
  } catch (e) {
    console.error("Erro carregando treinos:", e);
  } finally {
    setCarregandoTreinos(false);
  }
}, [uid]);

  useEffect(() => {
    if (uid) carregarTreinos();
  }, [uid, carregarTreinos]);

  // ===================== Quando troca o treino selecionado =====================
  useEffect(() => {
    const carregarExercicios = async () => {
      setMensagem("");
      setRemovidos([]);
      if (treinoId === "novo") {
        setTitulo("Treino A");
        setDescricao("");
        setExercicios([
          { nome: "", series: "3x12", videoId: "", grupo: "Outros", ordem: 1 },
        ]);
        return;
      }

      // Popular form com dados do treino
      const t = treinos.find((x) => x.id === treinoId);
      setTitulo(t?.titulo || "");
      setDescricao(t?.descricao || "");

      // Buscar exercícios do treino
      try {
        const exRef = collection(db, "users", uid, "treinos", treinoId, "exercicios");
        const q = query(exRef, orderBy("ordem"));
        const snap = await getDocs(q);
        const lista = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setExercicios(lista);
      } catch (e) {
        console.error("Erro carregando exercícios:", e);
        setExercicios([]);
      }
    };

    if (uid) carregarExercicios();
    // eslint-disable-next-line
  }, [uid, treinoId, treinos]);

  // ===================== Helpers de exercícios =====================
  const addLinha = () =>
    setExercicios((prev) => [
      ...prev,
      { nome: "", series: "3x12", videoId: "", grupo: "Outros", ordem: prev.length + 1 },
    ]);

  const rmLinha = (idx) =>
    setExercicios((prev) => {
      const alvo = prev[idx];
      if (alvo?.id) setRemovidos((r) => [...r, alvo.id]);
      return prev.filter((_, i) => i !== idx);
    });

  const setCampo = (idx, campo, valor) =>
    setExercicios((prev) => prev.map((ex, i) => (i === idx ? { ...ex, [campo]: valor } : ex)));

  // ===================== Salvar (criar/atualizar) =====================
  const salvarTreino = async () => {
    setMensagem("");
    if (!aluno) {
      setMensagem("Aluno não encontrado.");
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

    setSalvando(true);
    try {
      let idTreino = treinoId;

      if (treinoId === "novo") {
        // criar doc do treino
        const newRef = await addDoc(collection(db, "users", uid, "treinos"), {
          titulo: titulo.trim(),
          descricao: (descricao || "").trim(),
          ordem: 1,
          criadoEm: new Date(),
        });
        idTreino = newRef.id;
        // recarrega lista de treinos para aparecer na barra lateral
        await carregarTreinos();
        setTreinoId(idTreino);
      } else {
        // atualizar meta do treino
        await updateDoc(doc(db, "users", uid, "treinos", idTreino), {
          titulo: titulo.trim(),
          descricao: (descricao || "").trim(),
        });
      }

      // deletar exercícios removidos
      for (const exId of removidos) {
        await deleteDoc(doc(db, "users", uid, "treinos", idTreino, "exercicios", exId));
      }
      setRemovidos([]);

      // salvar/atualizar exercícios
      for (const ex of validos) {
        if (ex.id) {
          await updateDoc(doc(db, "users", uid, "treinos", idTreino, "exercicios", ex.id), {
            nome: ex.nome.trim(),
            series: ex.series.trim(),
            videoId: ex.videoId.trim(),
            grupo: ex.grupo || "Outros",
            ordem: Number(ex.ordem) || 1,
            atualizadoEm: new Date(),
          });
        } else {
          await addDoc(collection(db, "users", uid, "treinos", idTreino, "exercicios"), {
            nome: ex.nome.trim(),
            series: ex.series.trim(),
            videoId: ex.videoId.trim(),
            grupo: ex.grupo || "Outros",
            ordem: Number(ex.ordem) || 1,
            criadoEm: new Date(),
          });
        }
      }

      setMensagem("Treino salvo com sucesso!");
    } catch (e) {
      console.error("Erro ao salvar treino:", e);
      setMensagem("Erro ao salvar. Veja o console.");
    } finally {
      setSalvando(false);
    }
  };

  // ===================== Excluir treino inteiro =====================
  const excluirTreino = async () => {
    if (treinoId === "novo") return;
    const ok = window.confirm("Tem certeza que deseja excluir este treino e todos os exercícios?");
    if (!ok) return;

    setExcluindoTreino(true);
    try {
      // excluir subcoleção exercícios
      const exRef = collection(db, "users", uid, "treinos", treinoId, "exercicios");
      const snap = await getDocs(exRef);
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));

      // excluir treino
      await deleteDoc(doc(db, "users", uid, "treinos", treinoId));

      // reset UI
      setTreinoId("novo");
      setTitulo("Treino A");
      setDescricao("");
      setExercicios([{ nome: "", series: "3x12", videoId: "", grupo: "Outros", ordem: 1 }]);

      // recarregar lista
      await carregarTreinos();
      setMensagem("Treino excluído.");
    } catch (e) {
      console.error("Erro excluindo treino:", e);
      setMensagem("Erro ao excluir treino. Veja o console.");
    } finally {
      setExcluindoTreino(false);
    }
  };

  if (loadingRole) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        Verificando acesso…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Gerenciar Treinos</h1>
          <button
            onClick={() => navigate("/admin/alunos")}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
          >
            Voltar à lista de alunos
          </button>
        </div>

        {/* Card do aluno */}
        <div className="bg-gray-800 p-4 rounded mb-6">
          {carregandoAluno ? (
            <div>Carregando dados do aluno…</div>
          ) : !aluno ? (
            <div className="text-red-300">Aluno não encontrado.</div>
          ) : (
            <div className="grid md:grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-gray-400">Nome completo</div>
                <div className="font-semibold">{aluno.nome || "-"}</div>
              </div>
              <div>
                <div className="text-gray-400">E‑mail</div>
                <div className="font-semibold">{aluno.email || "-"}</div>
              </div>
              <div>
                <div className="text-gray-400">Apelido</div>
                <div className="font-semibold">{aluno.apelido || "-"}</div>
              </div>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {/* Lado esquerdo: lista de treinos */}
          <div className="md:col-span-1">
            <div className="bg-gray-800 p-3 rounded">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold">Treinos do aluno</h2>
                <button
                  onClick={() => setTreinoId("novo")}
                  className={`px-3 py-1 rounded ${
                    treinoId === "novo" ? "bg-green-700" : "bg-green-600 hover:bg-green-700"
                  }`}
                >
                  + Novo
                </button>
              </div>

              {carregandoTreinos ? (
                <div className="text-gray-300">Carregando treinos…</div>
              ) : treinos.length === 0 ? (
                <div className="text-gray-400">Nenhum treino cadastrado ainda.</div>
              ) : (
                <ul className="divide-y divide-gray-700">
                  {treinos.map((t) => (
                    <li
                      key={t.id}
                      className={`p-2 cursor-pointer rounded ${
                        treinoId === t.id ? "bg-gray-700" : "hover:bg-gray-800"
                      }`}
                      onClick={() => setTreinoId(t.id)}
                    >
                      <div className="font-medium">{t.titulo || "(Sem título)"}</div>
                      {t.descricao && (
                        <div className="text-xs text-gray-300 mt-0.5">{t.descricao}</div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Lado direito: form de edição/criação */}
          <div className="md:col-span-2">
            <div className="bg-gray-800 p-4 rounded">
              <h2 className="text-lg font-semibold mb-3">
                {treinoId === "novo" ? "Novo treino" : "Editar treino"}
              </h2>

              <div className="grid md:grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-sm mb-1">Título do treino</label>
                  <input
                    className="w-full p-2 rounded text-black"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Descrição</label>
                  <input
                    className="w-full p-2 rounded text-black"
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                  />
                </div>
              </div>

              <h3 className="font-semibold mb-2">Exercícios</h3>
              {exercicios.map((ex, i) => (
                <div key={ex.id || i} className="bg-gray-900 p-3 rounded mb-3">
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
                      Remover exercício
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

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={salvarTreino}
                  disabled={salvando || !aluno}
                  className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded disabled:opacity-60"
                >
                  {salvando ? "Salvando…" : "Salvar treino"}
                </button>

                {treinoId !== "novo" && (
                  <button
                    onClick={excluirTreino}
                    disabled={excluindoTreino}
                    className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded disabled:opacity-60"
                  >
                    {excluindoTreino ? "Excluindo…" : "Excluir treino"}
                  </button>
                )}
              </div>

              {mensagem && <div className="mt-3 bg-gray-800 p-3 rounded">{mensagem}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}