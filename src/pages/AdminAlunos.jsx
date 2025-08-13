import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import { ADMIN_MASTER_EMAIL } from "../config";

export default function AdminAlunos() {
  const navigate = useNavigate();

  const [alunos, setAlunos] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const [buscaEmail, setBuscaEmail] = useState("");
  const [pagina, setPagina] = useState(1);
  const ITENS_POR_PAGINA = 10;

  const [nomePersonal, setNomePersonal] = useState("");
  const [isMaster, setIsMaster] = useState(false);

  // ==== saudação / master flag
  useEffect(() => {
    const run = async () => {
      const user = auth.currentUser;
      if (!user) return;

      setIsMaster((user.email || "").toLowerCase() === ADMIN_MASTER_EMAIL.toLowerCase());

      // tenta pegar nome do profile
      let nome = "";
      try {
        const perf = await getDoc(doc(db, "profiles", user.uid));
        if (perf.exists()) nome = perf.data()?.nome || perf.data()?.nomeCompleto || "";
      } catch (_) {}
      if (!nome) nome = user.displayName || user.email || "Personal";
      setNomePersonal(nome);
    };
    run();
  }, []);

  // ==== carrega alunos
  useEffect(() => {
    const carregar = async () => {
      setCarregando(true);
      try {
        let lista = [];
        // 1) profiles
        const perfis = await getDocs(collection(db, "profiles"));
        if (!perfis.empty) {
          lista = perfis.docs.map((d) => {
            const x = d.data() || {};
            return {
              uid: x.uid || d.id,
              nome: x.nome || x.nomeCompleto || "",
              nomeLower: (x.nomeLower || x.nome || x.nomeCompleto || "")
                .toString()
                .toLowerCase(),
              email: x.email || "",
              emailLower: (x.emailLower || x.email || "")
                .toString()
                .toLowerCase(),
              apelido: x.apelido || "",
            };
          });
        } else {
          // 2) fallback users
          const users = await getDocs(collection(db, "users"));
          lista = users.docs.map((d) => {
            const x = d.data() || {};
            const nome = x.nomeCompleto || x.nome || "";
            return {
              uid: d.id,
              nome,
              nomeLower: (nome || "").toString().toLowerCase(),
              email: x.email || "",
              emailLower: (x.email || "").toString().toLowerCase(),
              apelido: x.apelido || "",
            };
          });
        }
        lista.sort((a, b) => a.nomeLower.localeCompare(b.nomeLower, "pt-BR"));
        setAlunos(lista);
      } catch (e) {
        console.error("Erro carregando alunos:", e);
      } finally {
        setCarregando(false);
      }
    };
    carregar();
  }, []);

  useEffect(() => setPagina(1), [buscaEmail]);

  const alunosFiltrados = useMemo(() => {
    const t = (buscaEmail || "").trim().toLowerCase();
    if (!t) return alunos;
    return alunos.filter((a) => a.emailLower.includes(t));
  }, [alunos, buscaEmail]);

  const totalPaginas = Math.max(1, Math.ceil(alunosFiltrados.length / ITENS_POR_PAGINA));
  const inicio = (pagina - 1) * ITENS_POR_PAGINA;
  const paginaAtual = alunosFiltrados.slice(inicio, inicio + ITENS_POR_PAGINA);

  const irParaCadastro = (uid) => navigate(`/admin/treinos/${uid}`);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-5xl mx-auto">
        {/* Topo: saudação + ações */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Alunos</h1>
            <p className="text-gray-300 mt-1">
              Bem‑vindo, <span className="font-semibold">Personal {nomePersonal}</span>
            </p>
          </div>

          <div className="flex gap-2">
            {isMaster && (
              <button
                onClick={() => navigate("/admin/console")}
                className="bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded"
                title="Console do administrador"
              >
                Console de Usuários
              </button>
            )}
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded"
              title="Encerrar sessão"
            >
              Sair
            </button>
          </div>
        </div>

        {/* Busca */}
        <div className="bg-gray-800 p-4 rounded mb-4">
          <label className="block text-sm mb-2">
            Procure aqui o e‑mail do seu aluno
          </label>
          <div className="relative">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 103.6 3.6a7.5 7.5 0 0013.05 13.05z"
              />
            </svg>

            <input
              className="w-full pl-10 pr-3 py-2 rounded text-black"
              placeholder="Procure aqui o e‑mail do seu aluno"
              value={buscaEmail}
              onChange={(e) => setBuscaEmail(e.target.value)}
            />
          </div>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-gray-700">
            <thead>
              <tr className="bg-gray-900">
                <th className="p-2 border border-gray-700 text-left">Nome</th>
                <th className="p-2 border border-gray-700 text-left">E‑mail</th>
                <th className="p-2 border border-gray-700 text-left">Apelido</th>
                <th className="p-2 border border-gray-700"></th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr>
                  <td colSpan={4} className="p-3 text-center text-gray-300">
                    Carregando…
                  </td>
                </tr>
              ) : paginaAtual.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-3 text-center text-gray-400">
                    Nenhum aluno encontrado.
                  </td>
                </tr>
              ) : (
                paginaAtual.map((a) => (
                  <tr key={a.uid} className="hover:bg-gray-800/40">
                    <td className="p-2 border border-gray-700">{a.nome || "-"}</td>
                    <td className="p-2 border border-gray-700">{a.email || "-"}</td>
                    <td className="p-2 border border-gray-700">{a.apelido || "-"}</td>
                    <td className="p-2 border border-gray-700 text-right">
                      <button
                        onClick={() => irParaCadastro(a.uid)}
                        className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded"
                      >
                        Selecionar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* paginação */}
        <div className="flex items-center justify-center gap-3 mt-3">
          <button
            disabled={pagina <= 1}
            onClick={() => setPagina((p) => Math.max(1, p - 1))}
            className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded disabled:opacity-50"
          >
            Anterior
          </button>
          <span className="text-gray-300">
            Página {pagina} de {totalPaginas}
          </span>
          <button
            disabled={pagina >= totalPaginas}
            onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
            className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded disabled:opacity-50"
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}