import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, setDoc, doc, deleteDoc } from "firebase/firestore";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import { ADMIN_MASTER_EMAIL as MASTER_EMAIL } from "../config";

export default function AdminConsole() {
  const navigate = useNavigate();

  // Usuário logado (para exibir "Bem-vindo" e checar se é MASTER)
  const [user, setUser] = useState(null);
  const isMaster = user?.email === MASTER_EMAIL;

  // Dados carregados
  const [todos, setTodos] = useState([]);
  const [carregando, setCarregando] = useState(true);

  // UI
  const [busca, setBusca] = useState("");
  const [tab, setTab] = useState("alunos"); // "alunos" | "personais"

  // Lista de personais para combobox de vínculo
  const [personais, setPersonais] = useState([]);

  // ==== auth listener (boas-vindas / controle) ====
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        navigate("/"); // sem sessão
      } else {
        setUser(u);
      }
    });
    return () => unsub();
  }, [navigate]);

  // ==== carregar perfis + roles ====
  useEffect(() => {
    const carregar = async () => {
      setCarregando(true);
      try {
        // Perfis (prioriza "profiles/", cai para "users/" se não existir)
        let basePerfis = [];
        const perfisSnap = await getDocs(collection(db, "profiles"));
        if (!perfisSnap.empty) {
          basePerfis = perfisSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        } else {
          const usersSnap = await getDocs(collection(db, "users"));
          basePerfis = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        }

        // Roles
        const rolesSnap = await getDocs(collection(db, "userRoles"));
        const rolesByUid = Object.fromEntries(
          rolesSnap.docs.map((d) => [d.id, d.data()?.role || "student"])
        );

        // Junta / normaliza
        const unidos = basePerfis.map((p) => {
          const uid = p.uid || p.id;
          return {
            uid,
            email: p.email || "",
            nome: p.nome || p.nomeCompleto || "",
            apelido: p.apelido || "",
            trainerId: p.trainerId || "",
            role: rolesByUid[uid] || "student",
          };
        });

        unidos.sort((a, b) =>
          (a.nome || "").toLowerCase().localeCompare((b.nome || "").toLowerCase(), "pt-BR")
        );

        setTodos(unidos);
      } catch (e) {
        console.error("Erro carregando console:", e);
      } finally {
        setCarregando(false);
      }
    };
    carregar();
  }, []);

  // Combobox de vínculo (apenas personais)
  useEffect(() => {
    setPersonais(todos.filter((u) => u.role === "trainer"));
  }, [todos]);

  // Filtro + aba
  const filtrados = useMemo(() => {
    const t = (busca || "").trim().toLowerCase();
    let base =
      tab === "alunos"
        ? todos.filter((u) => u.role !== "trainer")
        : todos.filter((u) => u.role === "trainer");

    if (!t) return base;
    return base.filter(
      (u) =>
        (u.email || "").toLowerCase().includes(t) ||
        (u.nome || "").toLowerCase().includes(t)
    );
  }, [todos, busca, tab]);

  // ==== ações ====

  // Vínculo aluno → personal (trainer e master podem)
  const setVinculoAluno = async (uidAluno, trainerId) => {
    try {
      await setDoc(doc(db, "profiles", uidAluno), { trainerId }, { merge: true });
      setTodos((prev) => prev.map((u) => (u.uid === uidAluno ? { ...u, trainerId } : u)));
    } catch (e) {
      console.error("Erro vinculando aluno:", e);
      alert("Não foi possível vincular o aluno. Veja o console.");
    }
  };

  // Trocar papel (apenas master)
  const setRole = async (uid, novaRole) => {
    if (!isMaster) return;
    try {
      await setDoc(doc(db, "userRoles", uid), { role: novaRole }, { merge: true });
      setTodos((prev) => prev.map((u) => (u.uid === uid ? { ...u, role: novaRole } : u)));
    } catch (e) {
      console.error("Erro definindo papel:", e);
      alert("Não foi possível alterar o papel. Veja o console.");
    }
  };

  // Excluir perfil (apenas master) — não remove o usuário do Auth
  const excluirPerfil = async (uid) => {
    if (!isMaster) return;
    if (!window.confirm("Excluir perfil do Firestore? (O login do Auth NÃO será apagado)")) return;
    try {
      // tenta apagar nas duas coleções (perfil legado ou atual)
      await deleteDoc(doc(db, "profiles", uid)).catch(() => {});
      await deleteDoc(doc(db, "users", uid)).catch(() => {});
      await deleteDoc(doc(db, "userRoles", uid)).catch(() => {});
      setTodos((prev) => prev.filter((u) => u.uid !== uid));
    } catch (e) {
      console.error("Erro ao excluir perfil:", e);
      alert("Não foi possível excluir. Veja o console.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  // Exibe nome do personal: displayName do Auth, senão e-mail
  const nomePersonal = user?.displayName || user?.email || "Personal";

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold">
              Bem-vindo Personal{" "}
              <span className="text-blue-400">{nomePersonal}</span>
            </h1>
            <p className="text-gray-300">
              Console administrativo {isMaster ? "(Master)" : ""} — gerencie papéis,
              vínculos e perfis dos usuários.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate("/admin/alunos")}
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded"
            >
              Ir para alunos
            </button>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded"
            >
              Sair
            </button>
          </div>
        </div>

        {/* Abas */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setTab("alunos")}
            className={`px-3 py-1 rounded ${
              tab === "alunos" ? "bg-gray-700" : "bg-gray-800 hover:bg-gray-700"
            }`}
          >
            Alunos
          </button>
          <button
            onClick={() => setTab("personais")}
            className={`px-3 py-1 rounded ${
              tab === "personais" ? "bg-gray-700" : "bg-gray-800 hover:bg-gray-700"
            }`}
          >
            Personais
          </button>
        </div>

        {/* Busca */}
        <div className="bg-gray-800 p-3 rounded mb-3">
          <input
            className="w-full p-2 rounded text-black"
            placeholder="Buscar por nome ou e‑mail"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-gray-700">
            <thead>
              <tr className="bg-gray-900">
                <th className="p-2 border border-gray-700 text-left">Nome</th>
                <th className="p-2 border border-gray-700 text-left">E‑mail</th>
                <th className="p-2 border border-gray-700 text-left">Papel</th>
                <th className="p-2 border border-gray-700 text-left">Vínculo</th>
                <th className="p-2 border border-gray-700"></th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr>
                  <td colSpan={5} className="p-3 text-center text-gray-300">
                    Carregando…
                  </td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-3 text-center text-gray-400">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                filtrados.map((u) => (
                  <tr key={u.uid} className="hover:bg-gray-800/40">
                    <td className="p-2 border border-gray-700">{u.nome || "-"}</td>
                    <td className="p-2 border border-gray-700">{u.email || "-"}</td>
                    <td className="p-2 border border-gray-700">
                      {/* Troca de papel: somente master */}
                      <div className="flex gap-2">
                        <button
                          disabled={!isMaster}
                          onClick={() => setRole(u.uid, "student")}
                          className={`px-2 py-1 rounded ${
                            u.role !== "trainer"
                              ? "bg-emerald-700"
                              : "bg-gray-700 hover:bg-gray-600"
                          } ${!isMaster ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          Aluno
                        </button>
                        <button
                          disabled={!isMaster}
                          onClick={() => setRole(u.uid, "trainer")}
                          className={`px-2 py-1 rounded ${
                            u.role === "trainer"
                              ? "bg-emerald-700"
                              : "bg-gray-700 hover:bg-gray-600"
                          } ${!isMaster ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          Personal
                        </button>
                      </div>
                    </td>
                    <td className="p-2 border border-gray-700">
                      {/* Vínculo aluno → personal: trainers e master podem */}
                      {u.role === "trainer" ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <select
                          className="p-1 rounded text-black"
                          value={u.trainerId || ""}
                          onChange={(e) => setVinculoAluno(u.uid, e.target.value)}
                        >
                          <option value="">(sem vínculo)</option>
                          {personais.map((p) => (
                            <option key={p.uid} value={p.uid}>
                              {p.nome || p.email}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="p-2 border border-gray-700 text-right">
                      <button
                        disabled={!isMaster}
                        onClick={() => excluirPerfil(u.uid)}
                        className={`px-3 py-1 rounded ${
                          isMaster
                            ? "bg-red-600 hover:bg-red-700"
                            : "bg-gray-700 opacity-50 cursor-not-allowed"
                        }`}
                      >
                        Excluir perfil
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}