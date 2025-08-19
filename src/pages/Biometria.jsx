/**
 * FICHA BIOMÉTRICA
 * - Tela para registrar medidas corporais e ver histórico (últimos 12 registros).
 * - Grava em: users/{uid}/medidas/{YYYY-MM-DD}
 *
 * DEPENDÊNCIAS:
 * - Firebase (Auth, Firestore)
 * - Tailwind CSS para estilos (opcional, mas recomendado)
 *
 * REGRAS (já compatíveis com as que você mostrou):
 * match /users/{userId}/{document=**} { allow read, write: if isOwner(userId) || isTrainer() || isAdmin(); }
 */

import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../firebase";
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

/** Opções de “fase” como no modelo antigo (Início/Meio/Fim) */
const FASES = [
  { value: "", label: "— Sem fase —" },
  { value: "inicio", label: "Início" },
  { value: "meio", label: "Meio" },
  { value: "fim", label: "Fim" },
];

/**
 * Campos que serão exibidos e gravados.
 * - key: chave no Firestore
 * - label: rótulo mostrado no input
 */
const CAMPOS = [
  { key: "peso", label: "Peso (kg)" },
  { key: "altura", label: "Altura (cm)" },
  { key: "busto", label: "Busto (cm)" },
  { key: "peito", label: "Peito (cm)" },
  { key: "abdomen", label: "Abdômen (cm)" },
  { key: "cintura", label: "Cintura (cm)" },
  { key: "quadril", label: "Quadril (cm)" },
  { key: "culote", label: "Culote (cm)" },
  { key: "bracoEsq", label: "Braço Esq. (cm)" },
  { key: "bracoDir", label: "Braço Dir. (cm)" },
  { key: "coxaEsq", label: "Coxa Esq. (cm)" },
  { key: "coxaDir", label: "Coxa Dir. (cm)" },
  { key: "panturrilhaEsq", label: "Panturrilha Esq. (cm)" },
  { key: "panturrilhaDir", label: "Panturrilha Dir. (cm)" },
];

/** Data atual em formato ISO (YYYY-MM-DD) para usar como ID do documento */
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Converte string para número (aceita vírgula).
 * - Retorna null se vazio/ inválido (para não gravar lixo no Firestore).
 */
function num(v) {
  if (v === "" || v == null) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Calcula IMC: peso(kg) / (altura(m)²). Altura informada em cm. */
function calcIMC(pesoKg, alturaCm) {
  const p = num(pesoKg);
  const a = num(alturaCm);
  if (!p || !a) return null;
  const alturaM = a / 100;
  const imc = p / (alturaM * alturaM);
  return Math.round(imc * 10) / 10; // 1 casa decimal
}

export default function Biometria() {
  // ---- Estado base de autenticação ----
  const [uid, setUid] = useState(null);

  // ---- Estado do formulário atual ----
  const [dataRef, setDataRef] = useState(todayISO()); // ID do doc (1 registro por dia)
  const [fase, setFase] = useState("");
  const [obs, setObs] = useState("");
  const [valores, setValores] = useState(() =>
    Object.fromEntries(CAMPOS.map((c) => [c.key, ""])) // objeto inicial {peso:"", altura:"", ...}
  );

  // IMC recalculado sempre que peso/altura mudam
  const imc = useMemo(() => calcIMC(valores.peso, valores.altura), [valores]);

  // ---- Histórico (últimos 12 registros) ----
  const [loading, setLoading] = useState(true);
  const [historico, setHistorico] = useState([]);

  // ---- Mensagens de feedback ----
  const [ok, setOk] = useState("");
  const [erro, setErro] = useState("");

  /**
   * Observa o estado de autenticação.
   * - onAuthStateChanged garante que pegamos o UID assim que o usuário loga.
   * - Se não houver usuário -> bloqueia a tela com alerta simples.
   */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setUid(null);
        setErro("Você precisa estar logado para registrar medidas.");
        setLoading(false);
        return;
      }
      setErro("");
      setUid(user.uid);
      carregarHistorico(user.uid);
    });
    return unsub;
  }, []);

  /**
   * Carrega últimos 12 registros do usuário.
   * - Usa subcoleção: users/{uid}/medidas
   * - Ordena por campo "date" (Timestamp) desc
   */
  async function carregarHistorico(userId) {
    setLoading(true);
    try {
      const ref = collection(db, "users", userId, "medidas");
      const q = query(ref, orderBy("date", "desc"), limit(12));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setHistorico(list);
    } catch (e) {
      console.error("[Biometria] Erro ao carregar histórico:", e);
      setErro("Não foi possível carregar o histórico.");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Persiste o formulário atual.
   * - Valida mínimo (peso/altura)
   * - ID do doc = dataRef (YYYY-MM-DD) para facilitar comparação mensal/semanal
   * - Usa merge:true para permitir editar o mesmo dia sem sobrescrever tudo
   */
  async function salvar() {
    setOk("");
    setErro("");

    if (!uid) {
      setErro("Não autenticado.");
      return;
    }

    // Validação mínima (pode expandir conforme regra do negócio)
    if (!num(valores.peso) || !num(valores.altura)) {
      setErro("Informe pelo menos Peso e Altura.");
      return;
    }

    try {
      const docId = dataRef; // 1 doc por dia
      const ref = doc(db, "users", uid, "medidas", docId);

      // Monta payload convertendo strings -> números
      const payload = {
        // Gravamos a data como Timestamp para poder ordenar/filtrar por servidor
        date: Timestamp.fromDate(new Date(dataRef + "T12:00:00")),
        fase: fase || null,
        observacoes: obs || "",
        imc: calcIMC(valores.peso, valores.altura),
      };

      // Itera todos os campos e converte com segurança
      for (const c of CAMPOS) {
        payload[c.key] = num(valores[c.key]);
      }

      await setDoc(ref, payload, { merge: true });

      setOk("Medidas salvas!");
      await carregarHistorico(uid); // refresh do histórico
    } catch (e) {
      console.error("[Biometria] Falha ao salvar:", e);
      setErro("Falha ao salvar. Verifique sua conexão ou permissões.");
    }
  }

  /** Reseta formulário para um novo registro no dia atual */
  function limpar() {
    setDataRef(todayISO());
    setFase("");
    setObs("");
    setValores(Object.fromEntries(CAMPOS.map((c) => [c.key, ""])));
    setOk("");
    setErro("");
  }

  /**
   * Badge de diferença entre dois valores (ex.: peso atual vs anterior)
   * - Verde (negativo) = redução
   * - Vermelho (positivo) = aumento
   */
  const diffBadge = (valorAtual, valorAnterior) => {
    const a = num(valorAtual);
    const b = num(valorAnterior);
    if (a == null || b == null) return null;
    const d = Math.round((a - b) * 10) / 10;
    if (d === 0) return <span className="text-xs text-gray-500">=</span>;
    const cls =
      d < 0 ? "bg-green-600/10 text-green-500" : "bg-red-600/10 text-red-500";
    return (
      <span className={`text-xs px-2 py-0.5 rounded ${cls}`}>
        {d > 0 ? `+${d}` : d}
      </span>
    );
  };

  // Pega último e penúltimo registro para comparação rápida
  const ultimo = historico[0];
  const penultimo = historico[1];

  // ===================== RENDER =====================
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Cabeçalho da página */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Ficha Biométrica
        </h1>
        <p className="text-slate-400 mt-1">
          Registre medidas corporais e acompanhe a evolução.
        </p>
      </div>

      {/* Layout principal: formulário + cards de resumo + tabela */}
      <div className="max-w-6xl mx-auto px-4 pb-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ===== Card: Formulário ===== */}
        <div className="lg:col-span-2">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl shadow-lg">
            {/* Título do card com IMC ao lado */}
            <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium">Novo Registro</h2>
                <p className="text-xs text-slate-400">
                  Use valores em centímetros e quilos.
                </p>
              </div>
              {imc ? (
                <div className="text-right">
                  <div className="text-xs uppercase text-slate-400">IMC</div>
                  <div className="text-2xl font-bold">{imc}</div>
                </div>
              ) : null}
            </div>

            {/* Inputs principais */}
           <div className="p-4 sm:p-6 space-y-4">
              {/* Linha: data, fase, observações rápidas */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="flex flex-col text-sm">
                  <span className="text-slate-300 mb-1">Data</span>
                  <input
                    type="date"
                    value={dataRef}
                    onChange={(e) => setDataRef(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 outline-none focus:border-slate-600"
                  />
                </label>

                <label className="flex flex-col text-sm">
                  <span className="text-slate-300 mb-1">Fase</span>
                  <select
                    value={fase}
                    onChange={(e) => setFase(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 outline-none focus:border-slate-600"
                  >
                    {FASES.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col text-sm">
                  <span className="text-slate-300 mb-1">Observações</span>
                  <input
                    type="text"
                    placeholder="opcional"
                    value={obs}
                    onChange={(e) => setObs(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 outline-none focus:border-slate-600"
                  />
                </label>
              </div>

              {/* Grid de campos numéricos (responsivo) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {CAMPOS.map((c) => (
                  <label key={c.key} className="flex flex-col text-sm">
                    <span className="text-slate-300 mb-1">{c.label}</span>
                    <input
                      type="number"
                      inputMode="decimal"  // facilita no mobile
                      step="0.1"
                      placeholder="0.0"
                      value={valores[c.key]}
                      onChange={(e) =>
                        setValores((old) => ({ ...old, [c.key]: e.target.value }))
                      }
                      className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 outline-none focus:border-slate-600"
                    />
                  </label>
                ))}
              </div>

              {/* Ações do formulário */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={salvar}
                  className="bg-indigo-600 hover:bg-indigo-500 transition-colors px-4 py-2 rounded-lg font-medium"
                >
                  Salvar medidas
                </button>
                <button
                  onClick={limpar}
                  className="bg-slate-800 hover:bg-slate-700 transition-colors px-4 py-2 rounded-lg"
                >
                  Limpar
                </button>

                {/* Feedback inline */}
                {ok && <span className="text-green-400 text-sm">{ok}</span>}
                {erro && <span className="text-red-400 text-sm">{erro}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* ===== Card: Resumo rápido (IMC e variações) ===== */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl shadow-lg">
          <div className="p-4 sm:p-6 border-b border-slate-800">
            <h2 className="text-lg font-medium">Resumo</h2>
          </div>
          <div className="p-4 sm:p-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">Último IMC</span>
              <span className="text-xl font-semibold">
                {ultimo?.imc ?? "—"}
              </span>
            </div>

            {/* Cartõezinhos com diferença vs penúltimo registro */}
            <div className="grid grid-cols-2 gap-2">
              {["peso", "cintura", "quadril", "coxaDir"].map((k) => (
                <div
                  key={k}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-3"
                >
                  <div className="text-xs text-slate-400 uppercase">{k}</div>
                  <div className="flex items-center gap-2">
                    <div className="text-lg font-semibold">
                      {ultimo?.[k] ?? "—"}
                    </div>
                    {penultimo ? diffBadge(ultimo?.[k], penultimo?.[k]) : null}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-500">
              Dica: variações negativas aparecem em verde; positivas em vermelho.
            </p>
          </div>
        </div>

        {/* ===== Tabela: Histórico (12 registros) ===== */}
        <div className="lg:col-span-3">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl shadow-lg overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-medium">Histórico (últimos 12)</h2>
              {loading && (
                <span className="text-xs text-slate-400 animate-pulse">
                  carregando…
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-950/60 text-slate-300">
                  <tr>
                    <th className="text-left px-4 py-2 border-b border-slate-800">Data</th>
                    <th className="text-left px-4 py-2 border-b border-slate-800">Fase</th>
                    {/* Mostrando um subconjunto de campos na tabela para não poluir */}
                    {CAMPOS.filter(c =>
                      ["peso","cintura","quadril","coxaDir","bracoDir"].includes(c.key)
                    ).map((c) => (
                      <th key={c.key} className="text-left px-4 py-2 border-b border-slate-800">
                        {c.label}
                      </th>
                    ))}
                    <th className="text-left px-4 py-2 border-b border-slate-800">IMC</th>
                    <th className="text-left px-4 py-2 border-b border-slate-800">Obs.</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Estado vazio amigável */}
                  {historico.length === 0 && !loading && (
                    <tr>
                      <td className="px-4 py-4 text-slate-400" colSpan={8}>
                        Sem registros ainda.
                      </td>
                    </tr>
                  )}

                  {/* Linhas do histórico */}
                  {historico.map((r) => (
                    <tr key={r.id} className="odd:bg-slate-900/30">
                      <td className="px-4 py-2 border-b border-slate-800">
                        {r.date?.toDate
                          ? r.date.toDate().toLocaleDateString()
                          : r.id /* fallback: o próprio id YYYY-MM-DD */}
                      </td>
                      <td className="px-4 py-2 border-b border-slate-800 capitalize">
                        {r.fase ?? "—"}
                      </td>
                      <td className="px-4 py-2 border-b border-slate-800">{r.peso ?? "—"}</td>
                      <td className="px-4 py-2 border-b border-slate-800">{r.cintura ?? "—"}</td>
                      <td className="px-4 py-2 border-b border-slate-800">{r.quadril ?? "—"}</td>
                      <td className="px-4 py-2 border-b border-slate-800">{r.coxaDir ?? "—"}</td>
                      <td className="px-4 py-2 border-b border-slate-800">{r.bracoDir ?? "—"}</td>
                      <td className="px-4 py-2 border-b border-slate-800">{r.imc ?? "—"}</td>
                      <td
                        className="px-4 py-2 border-b border-slate-800 max-w-[240px] truncate"
                        title={r.observacoes || ""}
                      >
                        {r.observacoes || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
