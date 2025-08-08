import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import useIsTrainer from "../hooks/useIsTrainer";

export default function Dashboard() {
  const [treinos, setTreinos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authUid, setAuthUid] = useState(null);

  // Só para treinador
  const [alunoUidConsulta, setAlunoUidConsulta] = useState("");
  const [carregandoConsulta, setCarregandoConsulta] = useState(false);

  const navigate = useNavigate();
  const { isTrainer, loadingRole } = useIsTrainer();

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  // Captura o UID do usuário logado (treinador ou aluno)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate("/");
      } else {
        setAuthUid(user.uid);
      }
    });
    return () => unsub();
    // eslint-disable-next-line
  }, []);

  // Carrega treinos do ALUNO (do próprio usuário se for aluno comum)
  useEffect(() => {
    // aguarda saber o papel
    if (loadingRole) return;

    // Se não autenticado ainda, espera
    if (!authUid) return;

    // Aluno comum → carrega os treinos dele automaticamente
    if (!isTrainer) {
      carregarTreinos(authUid);
    } else {
      // Treinador → não carrega nada até escolher um aluno
      setTreinos([]);
      setLoading(false);
    }
    // eslint-disable-next-line
  }, [authUid, isTrainer, loadingRole]);

  const carregarTreinos = async (uid) => {
    setLoading(true);
    try {
      const treinosRef = collection(db, "users", uid, "treinos");
      const treinosSnap = await getDocs(treinosRef);

      if (!treinosSnap.empty) {
        const listaTreinos = [];

        for (const treinoDoc of treinosSnap.docs) {
          const dadosTreino = treinoDoc.data();

          // Subcoleção: exercícios
          const exerciciosRef = collection(treinoDoc.ref, "exercicios");
          const exerciciosSnap = await getDocs(exerciciosRef);

          const listaExercicios = exerciciosSnap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999));

          listaTreinos.push({
            id: treinoDoc.id,
            ...dadosTreino,
            exercicios: listaExercicios,
          });
        }

        // Ordena treinos por ordem se existir
        listaTreinos.sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999));
        setTreinos(listaTreinos);
      } else {
        setTreinos([]);
      }
    } catch (err) {
      console.error("Erro ao carregar treinos:", err);
      setTreinos([]);
    } finally {
      setLoading(false);
    }
  };

  const buildEmbed = (videoId) =>
    `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;

  // UI de carregamento (papel ou dados)
  if (loadingRole || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-900 text-white">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Meus Treinos</h1>

        {/* Painel do treinador */}
        {isTrainer && (
          <div className="bg-gray-800 p-4 rounded mb-6">
            <div className="text-sm text-gray-300 mb-2">
              Você está logado como <span className="font-semibold">treinador</span>.
            </div>
            <label className="block text-sm mb-1">
              Consultar treinos de um aluno (cole o UID do aluno)
            </label>
            <div className="flex gap-2">
              <input
                className="flex-1 p-2 rounded text-black"
                placeholder="UID do aluno (Authentication → Users)"
                value={alunoUidConsulta}
                onChange={(e) => setAlunoUidConsulta(e.target.value)}
              />
              <button
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
                onClick={async () => {
                  if (!alunoUidConsulta.trim()) return;
                  setCarregandoConsulta(true);
                  await carregarTreinos(alunoUidConsulta.trim());
                  setCarregandoConsulta(false);
                }}
              >
                {carregandoConsulta ? "Carregando..." : "Carregar"}
              </button>
            </div>
          </div>
        )}

        {/* Lista de treinos (aluno ou consulta do treinador) */}
        {treinos.length === 0 && (
          <p className="text-gray-400">Nenhum treino encontrado.</p>
        )}

        {treinos.map((treino) => (
          <div key={treino.id} className="mb-10">
            <h2 className="text-2xl font-semibold mb-2">{treino.titulo}</h2>
            <p className="text-gray-400 mb-4">{treino.descricao}</p>

            {(() => {
              // Agrupar por grupo muscular
              const grupos = {};
              treino.exercicios.forEach((ex) => {
                const g = (ex.grupo || "Outros").trim();
                if (!grupos[g]) grupos[g] = [];
                grupos[g].push(ex);
              });

              const nomesGrupos = Object.keys(grupos).sort((a, b) =>
                a.localeCompare(b)
              );

              return nomesGrupos.map((g) => (
                <div key={g} className="mb-8">
                  <h3 className="text-xl font-semibold mb-3">{g}</h3>

                  {grupos[g]
                    .sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999))
                    .map((ex) => (
                      <div
                        key={ex.id}
                        className="bg-gray-800 p-4 rounded mb-4 shadow-md"
                      >
                        <h4 className="text-lg font-semibold mb-1">
                          {ex.nome}
                        </h4>
                        <p className="mb-2 text-gray-300">Séries: {ex.series}</p>

                        {ex.videoId && (
                          <div className="aspect-video mb-3">
                            <iframe
                              className="w-full h-full rounded"
                              src={buildEmbed(ex.videoId)}
                              title={ex.nome}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              ));
            })()}
          </div>
        ))}

        <button
          onClick={handleLogout}
          className="mt-8 bg-red-600 px-4 py-2 rounded hover:bg-red-700"
        >
          Sair
        </button>
      </div>
    </div>
  );
}