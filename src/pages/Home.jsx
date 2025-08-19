import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";

const todayId = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [treinos, setTreinos] = useState([]);
  const [concluidosHoje, setConcluidosHoje] = useState([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return navigate("/");
      setUser(u);

      // perfil
      try {
        const perfDoc = await getDoc(doc(db, "profiles", u.uid));
        if (perfDoc.exists()) {
          setPerfil(perfDoc.data() || {});
        }
      } catch { }

      // carrega treinos
      const lista = [];
      const snap = await getDocs(collection(db, "users", u.uid, "treinos"));
      for (const t of snap.docs) {
        const data = t.data() || {};
        const exSnap = await getDocs(collection(t.ref, "exercicios"));
        lista.push({ id: t.id, titulo: data.titulo || "Treino", totalEx: exSnap.size });
      }
      setTreinos(lista);

      // progresso de hoje
      const pid = todayId();
      const comProgresso = [];
      for (const t of lista) {
        const progDoc = await getDoc(doc(db, "users", u.uid, "treinos", t.id, "progresso", pid));
        if (progDoc.exists()) {
          const doneArr = progDoc.data().done || [];
          if (doneArr.length > 0) {
            comProgresso.push({
              id: t.id,
              titulo: t.titulo,
              feitos: doneArr.length,
              total: t.totalEx,
            });
          }
        }
      }
      setConcluidosHoje(comProgresso);
    });
    return () => unsub();
  }, [navigate]);

  const primeiroNome = useMemo(() => {
    const raw = perfil?.nome || user?.email || "";
    return (raw || "").split(" ")[0];
  }, [perfil, user]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 pt-safe">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Início</h1>
        </div>

        <div className="bg-gray-800 p-4 rounded mt-4">
          <p className="text-lg">
            Olá, <b>{primeiroNome || "aluno"}</b> 👋
          </p>
          <p className="text-gray-300">
            Aqui você acompanha seus treinos do dia e volta para o painel.
          </p>

          <div className="mt-3 rounded bg-slate-800/80">
            <button
              onClick={() => navigate("/dashboard")}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
            >
              Ir para treinos
            </button>
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded mt-4">
          <h2 className="text-xl font-semibold mb-2">Status de hoje</h2>

          {treinos.length === 0 && (
            <p className="text-gray-400">Você ainda não tem treinos.</p>
          )}

          {treinos.length > 0 && (
            <>
              {concluidosHoje.length === 0 ? (
                <p className="text-gray-300">Nenhum treino concluído ainda hoje.</p>
              ) : (
                <ul className="list-disc pl-6 space-y-1">
                  {concluidosHoje.map((t) => (
                    <li key={t.id} className="text-green-400">
                      ✅ <b>{t.titulo}</b> — {t.feitos}/{t.total} exercícios concluídos
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
