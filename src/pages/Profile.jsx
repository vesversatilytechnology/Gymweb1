// src/pages/Profile.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { auth, db } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";
//import { Link } from "react-router-dom";

const UF_LIST = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

function idadeFrom(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return age;
}

function formatPhone(value) {
    if (!value) return "";
    value = value.replace(/\D/g, "").slice(0, 11);
    if (value.length <= 2) return `(${value}`;
    if (value.length <= 7) return `(${value.slice(0, 2)}) ${value.slice(2)}`;
    return `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
}

export default function Profile() {
    const navigate = useNavigate();

    // Hooks – sempre no topo
    const [user, setUser] = useState(() => auth.currentUser);
    const [snapLoading, setSnapLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [showSaved, setShowSaved] = useState(false);

    const [form, setForm] = useState({
        nome: "",
        telefone: "",
        nascimento: "",
        genero: "Masculino",
        email: "",
        altura: "",
        peso: "",
        objetivo: "",
        contatoEmergenciaNome: "",
        contatoEmergenciaTelefone: "",
        photoUrl: "",
        cep: "",
        estado: "",
        cidade: "",
        rua: "",
        numero: "",
        bairro: "",
    });

    const originalRef = useRef(form);

    useEffect(() => {
        const unsub = auth.onAuthStateChanged(async (u) => {
            if (!u) {
                navigate("/");
                return;
            }
            setUser(u);

            setSnapLoading(true);
            try {
                const pDoc = await getDoc(doc(db, "profiles", u.uid));
                const base = {
                    nome: "",
                    endereco: "",
                    telefone: "",
                    nascimento: "",
                    genero: "Masculino",
                    email: u.email || "",
                    altura: "",
                    peso: "",
                    objetivo: "",
                    contatoEmergenciaNome: "",
                    contatoEmergenciaTelefone: "",
                    photoUrl: "",
                };
                const data = pDoc.exists() ? { ...base, ...pDoc.data() } : base;
                setForm(data);
                originalRef.current = data;
            } catch (e) {
                console.warn("[Profile] getDoc falhou:", e?.message || e);
            } finally {
                setSnapLoading(false);
            }
        });
        return () => unsub();
    }, [navigate]);

    const idade = useMemo(() => idadeFrom(form.nascimento), [form.nascimento]);

    function patch(fields) {
        setForm((f) => ({ ...f, ...fields }));
    }

    function startEdit() {
        setEditMode(true);
    }

    function cancelEdit() {
        setForm(originalRef.current);
        setEditMode(false);
    }

    async function onSave() {
        if (!user) return;
        setSaving(true);
        try {
            const toSave = {
                ...form,
                email: user.email || form.email,
                updatedAt: serverTimestamp(),
            };
            await setDoc(doc(db, "profiles", user.uid), toSave, { merge: true });
            originalRef.current = toSave;
            setEditMode(false);
            setShowSaved(true);
            setTimeout(() => setShowSaved(false), 2000);
        } catch (e) {
            console.error(e);
            alert("Não foi possível salvar o perfil. Tente novamente.");
        } finally {
            setSaving(false);
        }
    }

    if (snapLoading) {
        return (
            <div className="min-h-screen bg-gray-900 text-white p-4">
                <div className="max-w-3xl mx-auto">Carregando perfil...</div>
            </div>
        );
    }

    const disableSaveCancel = !editMode || saving;

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4">
            {showSaved && (
                <div className="fixed top-4 right-4 bg-emerald-600 text-white px-4 py-2 rounded shadow-lg">
                    Salvo!
                </div>
            )}

            <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Meu perfil</h1>
                    <div className="flex gap-2">
                        <Link
                            to="/profile/photo"
                            className="px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-700"
                        >
                            Alterar foto
                        </Link>
                        <Link
                            to="/profile/change-password"
                            className="px-3 py-2 rounded bg-slate-600 hover:bg-slate-500"
                        >
                            Alterar senha
                        </Link>
                        <button
                            onClick={startEdit}
                            disabled={editMode}
                            className="px-3 py-2 rounded bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
                        >
                            Editar
                        </button>
                        <button
                            onClick={onSave}
                            disabled={disableSaveCancel}
                            className="px-3 py-2 rounded bg-green-600 hover:bg-green-700 disabled:opacity-50"
                        >
                            Salvar
                        </button>
                        <button
                            onClick={cancelEdit}
                            disabled={disableSaveCancel}
                            className="px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>

                {/* DADOS PESSOAIS */}
                <div className="bg-gray-800 rounded p-4">
                    <h2 className="text-xl font-semibold mb-3">Dados Pessoais</h2>

                    <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm text-gray-300">Nome</label>
                            <input
                                className="w-full mt-1 p-2 rounded bg-gray-900 border border-gray-700"
                                value={form.nome}
                                onChange={(e) => patch({ nome: e.target.value })}
                                disabled={!editMode}
                            />
                        </div>

                        <div>
                            <label className="text-sm text-gray-300">E-mail</label>
                            <input
                                className="w-full mt-1 p-2 rounded bg-gray-900 border border-gray-700"
                                value={form.email}
                                disabled
                            />
                        </div>

                        <div>
                            <label className="text-sm text-gray-300">Telefone</label>
                            <input
                                className="w-full mt-1 p-2 rounded bg-gray-900 border border-gray-700"
                                value={form.telefone}
                                onChange={(e) => patch({ telefone: formatPhone(e.target.value) })}
                                disabled={!editMode}
                                placeholder="(xx) xxxxx-xxxx"
                            />
                        </div>

                        <div>
                            <label className="text-sm text-gray-300">Gênero</label>
                            <select
                                className="w-full mt-1 p-2 rounded bg-gray-900 border border-gray-700"
                                value={form.genero}
                                onChange={(e) => patch({ genero: e.target.value })}
                                disabled={!editMode}
                            >
                                <option>Masculino</option>
                                <option>Feminino</option>
                                <option>Neutro</option>
                                <option>Outro</option>
                                <option>Prefiro não dizer</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-sm text-gray-300">Data de nascimento</label>
                            <input
                                type="date"
                                className="w-full mt-1 p-2 rounded bg-gray-900 border border-gray-700"
                                value={form.nascimento || ""}
                                onChange={(e) => patch({ nascimento: e.target.value })}
                                disabled={!editMode}
                            />
                        </div>

                        <div>
                            <label className="text-sm text-gray-300">Idade</label>
                            <input className="w-full mt-1 p-2 rounded bg-gray-900 border border-gray-700" value={idade || ""} disabled />
                        </div>
                    </div>
                </div>

                {/* ENDEREÇO */}
                <div className="bg-gray-800 rounded p-4">
                    <h2 className="text-xl font-semibold mb-3">Endereço</h2>

                    <div className="grid sm:grid-cols-3 gap-4">
                        <div>
                            <label className="text-sm text-gray-300">CEP</label>
                            <input
                                inputMode="numeric"
                                maxLength={9}
                                className="w-full mt-1 p-2 rounded bg-gray-900 border border-gray-700"
                                value={form.cep}
                                onChange={(e) => patch({ cep: e.target.value })}
                                disabled={!editMode}
                                placeholder="00000-000"
                            />
                        </div>

                        <div>
                            <label className="text-sm text-gray-300">Estado (UF)</label>
                            <select
                                className="w-full mt-1 p-2 rounded bg-gray-900 border border-gray-700"
                                value={form.estado}
                                onChange={(e) => patch({ estado: e.target.value })}
                                disabled={!editMode}
                            >
                                <option value="">Selecione…</option>
                                {UF_LIST.map((uf) => (
                                    <option key={uf} value={uf}>
                                        {uf}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-sm text-gray-300">Cidade</label>
                            <input
                                className="w-full mt-1 p-2 rounded bg-gray-900 border border-gray-700"
                                value={form.cidade}
                                onChange={(e) => patch({ cidade: e.target.value })}
                                disabled={!editMode}
                                placeholder="Nome da cidade"
                            />
                        </div>
                    </div>

                    <div className="grid sm:grid-cols-3 gap-4 mt-4">
                        <div className="sm:col-span-2">
                            <label className="text-sm text-gray-300">Rua</label>
                            <input
                                className="w-full mt-1 p-2 rounded bg-gray-900 border border-gray-700"
                                value={form.rua}
                                onChange={(e) => patch({ rua: e.target.value })}
                                disabled={!editMode}
                            />
                        </div>

                        <div>
                            <label className="text-sm text-gray-300">Número</label>
                            <input
                                className="w-full mt-1 p-2 rounded bg-gray-900 border border-gray-700"
                                value={form.numero}
                                onChange={(e) => patch({ numero: e.target.value })}
                                disabled={!editMode}
                            />
                        </div>
                    </div>

                    <div className="grid sm:grid-cols-1 gap-4 mt-4">
                        <div>
                            <label className="text-sm text-gray-300">Bairro</label>
                            <input
                                className="w-full mt-1 p-2 rounded bg-gray-900 border border-gray-700"
                                value={form.bairro}
                                onChange={(e) => patch({ bairro: e.target.value })}
                                disabled={!editMode}
                            />
                        </div>
                    </div>
                </div>

                {/* SAÚDE/OBJETIVO */}
                <div className="bg-gray-800 rounded p-4">
                    <h2 className="text-xl font-semibold mb-3">Saúde & Objetivo</h2>

                    <div className="grid sm:grid-cols-3 gap-4">
                        <div>
                            <label className="text-sm text-gray-300">Altura (cm)</label>
                            <input
                                className="w-full mt-1 p-2 rounded bg-gray-900 border border-gray-700"
                                value={form.altura}
                                onChange={(e) => patch({ altura: e.target.value })}
                                disabled={!editMode}
                                placeholder="ex: 178"
                            />
                        </div>
                        <div>
                            <label className="text-sm text-gray-300">Peso (kg)</label>
                            <input
                                className="w-full mt-1 p-2 rounded bg-gray-900 border border-gray-700"
                                value={form.peso}
                                onChange={(e) => patch({ peso: e.target.value })}
                                disabled={!editMode}
                                placeholder="ex: 82.5"
                            />
                        </div>
                        <div>
                            <label className="text-sm text-gray-300">Objetivo</label>
                            <select
                                className="w-full mt-1 p-2 rounded bg-gray-900 border border-gray-700"
                                value={form.objetivo}
                                onChange={(e) => patch({ objetivo: e.target.value })}
                                disabled={!editMode}
                            >
                                <option value="">Selecione…</option>
                                <option>Emagrecimento</option>
                                <option>Hipertrofia</option>
                                <option>Condicionamento físico</option>
                                <option>Saúde geral</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* CONTATO DE EMERGÊNCIA */}
                <div className="bg-gray-800 rounded p-4">
                    <h2 className="text-xl font-semibold mb-3">Contato de Emergência</h2>

                    <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm text-gray-300">Nome</label>
                            <input
                                className="w-full mt-1 p-2 rounded bg-gray-900 border border-gray-700"
                                value={form.contatoEmergenciaNome}
                                onChange={(e) => patch({ contatoEmergenciaNome: e.target.value })}
                                disabled={!editMode}
                            />
                        </div>
                        <div>
                            <label className="text-sm text-gray-300">Telefone</label>
                            <input
                                className="w-full mt-1 p-2 rounded bg-gray-900 border border-gray-700"
                                value={form.contatoEmergenciaTelefone}
                                onChange={(e) => patch({ contatoEmergenciaTelefone: formatPhone(e.target.value) })}
                                disabled={!editMode}
                                placeholder="(xx) xxxxx-xxxx"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}