import { useEffect, useMemo, useState, useCallback } from "react";
import { db, auth } from "../firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";

const todayId = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

export default function Dashboard() {
  const [treinos, setTreinos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selecionado, setSelecionado] = useState(""); // id do treino escolhido
  const [doneIds, setDoneIds] = useState(new Set()); // exercícios concluídos hoje para o treino selecionado

  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  const carregarProgressoDoTreino = useCallback(
    async (uid, treinoId) => {
      if (!uid || !treinoId) return;
      const pid = todayId();
      const ref = doc(db, "users", uid, "treinos", treinoId, "progresso", pid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const arr = snap.data().done || [];
        setDoneIds(new Set(arr));
      } else {
        setDoneIds(new Set());
      }
    },
    []
  );

  const carregarTreinos = useCallback(
    async (uid) => {
      try {
        const treinosRef = collection(db, "users", uid, "treinos");
        const treinosSnap = await getDocs(treinosRef);

        const lista = [];
        for (const treinoDoc of treinosSnap.docs) {
          const dadosTreino = treinoDoc.data();

          // subcoleção exercícios
          const exerciciosRef = collection(treinoDoc.ref, "exercicios");
          const exerciciosSnap = await getDocs(exerciciosRef);

          const listaEx = exerciciosSnap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999));

          lista.push({
            id: treinoDoc.id,
            ...dadosTreino,
            exercicios: listaEx,
          });
        }

        // ordena treinos por 'ordem' se existir, senão por título
        lista.sort((a, b) => {
          const ao = a.ordem ?? 999;
          const bo = b.ordem ?? 999;
          if (ao !== bo) return ao - bo;
          return (a.titulo || "").localeCompare(b.titulo || "");
        });

        setTreinos(lista);
        // define selecionado e carrega progresso
        const firstId = lista[0]?.id || "";
        const selected = selecionado || firstId;
        setSelecionado(selected);

        if (selected) {
          await carregarProgressoDoTreino(uid, selected);
        } else {
          setDoneIds(new Set());
        }
      } catch (err) {
        console.error("Erro ao carregar treinos:", err);
      } finally {
        setLoading(false);
      }
    },
    [selecionado, carregarProgressoDoTreino]
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate("/");
      } else {
        carregarTreinos(user.uid);
      }
    });
    return () => unsub();
  }, [navigate, carregarTreinos]);

  // sempre que o treino selecionado mudar, recarrega o progresso do dia
  useEffect(() => {
    const user = auth.currentUser;
    if (user && selecionado) carregarProgressoDoTreino(user.uid, selecionado);
  }, [selecionado, carregarProgressoDoTreino]);

  const buildEmbed = (videoId) =>
    `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;

  const treinoAtual = useMemo(
    () => treinos.find((t) => t.id === selecionado) || null,
    [treinos, selecionado]
  );

  const allDone =
    treinoAtual &&
    treinoAtual.exercicios?.length > 0 &&
    doneIds.size === treinoAtual.exercicios.length;

  const toggleExercicio = async (exId) => {
    const user = auth.currentUser;
    if (!user || !treinoAtual) return;

    const pid = todayId();
    const ref = doc(
      db,
      "users",
      user.uid,
      "treinos",
      treinoAtual.id,
      "progresso",
      pid
    );
    const jaConcluido = doneIds.has(exId);

    if (jaConcluido) {
      await setDoc(ref, { done: [] }, { merge: true }); // garante existência
      await updateDoc(ref, { done: arrayRemove(exId) });
      const next = new Set(doneIds);
      next.delete(exId);
      setDoneIds(next);
    } else {
      await setDoc(ref, { done: [] }, { merge: true }); // garante existência
      await updateDoc(ref, { done: arrayUnion(exId) });
      const next = new Set(doneIds);
      next.add(exId);
      setDoneIds(next);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-900 text-white">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-4xl mx-auto">
        {/* Barra de ações */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex gap-2">
            <button
              onClick={() => navigate("/home")}
              className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded"
            >
              ← Voltar
            </button>
            <button
              onClick={() => navigate("/timer")}
              className="bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded"
            >
              Cronômetro
            </button>
          </div>

          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded"
          >
            Sair
          </button>
        </div>

        <h1 className="text-3xl font-bold mb-4">Meus Treinos</h1>

        {/* Se tiver mais de um treino: seletor */}
        {treinos.length > 1 && (
          <div className="bg-gray-800 p-3 rounded mb-4">
            <label className="block text-sm mb-1">Escolha um treino</label>
            <select
              className="w-full text-black rounded p-2"
              value={selecionado}
              onChange={(e) => setSelecionado(e.target.value)}
            >
              {treinos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.titulo || "Treino sem título"}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Sem treinos */}
        {treinos.length === 0 && (
          <p className="text-gray-400">Nenhum treino encontrado.</p>
        )}

        {/* Treino atual */}
        {treinoAtual && (
          <div className="mb-10">
            <h2 className="text-2xl font-semibold mb-2">
              {treinoAtual.titulo}
            </h2>
            {!!treinoAtual.descricao && (
              <p className="text-gray-400 mb-4">{treinoAtual.descricao}</p>
            )}

            {/* AVISO: tudo concluído */}
            {allDone && (
              <div className="bg-green-700/30 border border-green-600 text-green-200 p-3 rounded mb-4">
                ✅ Você concluiu todos os exercícios de <b>{treinoAtual.titulo}</b> hoje!
              </div>
            )}

            {/* Agrupar por grupo */}
            {(() => {
              const grupos = {};
              (treinoAtual.exercicios || []).forEach((ex) => {
                const g = (ex.grupo || "Outros").trim();
                if (!grupos[g]) grupos[g] = [];
                grupos[g].push(ex);
              });
              const nomes = Object.keys(grupos).sort((a, b) =>
                a.localeCompare(b)
              );

              return nomes.map((g) => (
                <div key={g} className="mb-8">
                  <h3 className="text-xl font-semibold mb-3">{g}</h3>

                  {grupos[g]
                    .sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999))
                    .map((ex) => {
                      const done = doneIds.has(ex.id);
                      return (
                        <div
                          key={ex.id}
                          className="bg-gray-800 p-4 rounded mb-4 shadow-md"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-lg font-semibold mb-1">
                                {ex.nome}
                              </h4>
                              <p className="mb-2 text-gray-300">
                                Séries: {ex.series}
                              </p>
                            </div>

                            <button
                              onClick={() => toggleExercicio(ex.id)}
                              className={`px-4 py-2 rounded ${
                                done
                                  ? "bg-yellow-600 hover:bg-yellow-700"
                                  : "bg-green-600 hover:bg-green-700"
                              }`}
                            >
                              {done ? "Desmarcar" : "Concluir exercício"}
                            </button>
                          </div>

                          {ex.videoId && (
                            <div className="aspect-video mt-3">
                              <iframe
                                className="w-full h-full rounded"
                                src={`https://www.youtube.com/embed/${ex.videoId}?rel=0&modestbranding=1`}
                                title={ex.nome}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              ));
            })()}
          </div>
        )}
      </div>
    </div>
  );
}