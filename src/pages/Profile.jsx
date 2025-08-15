import { useEffect, useMemo, useRef, useState } from "react";
import { auth, db, storage } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useNavigate } from "react-router-dom";

const UF_LIST = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT",
    "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS",
    "RO", "RR", "SC", "SP", "SE", "TO"
];

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
    // Remove tudo que não é dígito
    value = value.replace(/\D/g, "");
    // Limita a 11 dígitos (DDD + 9 números)
    value = value.slice(0, 11);
    if (value.length <= 2) return `(${value}`;
    if (value.length <= 7) return `(${value.slice(0, 2)}) ${value.slice(2)}`;
    return `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
}


export default function Profile() {
    const navigate = useNavigate();
    const [user, setUser] = useState(() => auth.currentUser);
    const [snapLoading, setSnapLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const fileInputRef = useRef(null);

    const [avatarUrl, setAvatarUrl] = useState("");
    const [pendingFile, setPendingFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState("");
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    // dados do perfil no formulário
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

    // guardamos um "original" para poder cancelar
    const originalRef = useRef(form);

    // câmera (fallback getUserMedia)
    const [takingPhoto, setTakingPhoto] = useState(false);
    const videoRef = useRef(null);
    const streamRef = useRef(null);

    useEffect(() => {
        const unsub = auth.onAuthStateChanged(async (u) => {
            if (!u) {
                navigate("/");
                return;
            }
            setUser(u);

            // carrega o perfil
            setSnapLoading(true);
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
            setAvatarUrl(data.photoUrl || "");   // <— traz a foto gravada, se existir
            originalRef.current = data;
            setSnapLoading(false);
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
        stopCamera();
        setTakingPhoto(false);

        // 🔽 limpa preview/arquivo pendente
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl("");
        }
        setPendingFile(null);
        setEditMode(false);
    }

    async function onSave() {
        if (!user) return;
        setSaving(true);
        try {
            // 1) se tiver arquivo pendente, sobe AGORA e guarda numa variável local
            let photoUrlToSave = form.photoUrl;
            if (pendingFile) {
                setUploading(true);
                photoUrlToSave = await uploadAvatarAndGetUrl(user.uid, pendingFile);
            }

            // 2) monta o payload usando a variável local (e não esperando o setState)
            const toSave = {
                ...form,
                photoUrl: photoUrlToSave,
                email: user.email || form.email,
                updatedAt: serverTimestamp(),
            };

            // 3) persiste no Firestore
            await setDoc(doc(db, "profiles", user.uid), toSave, { merge: true });

            // 4) sincroniza estado local + limpa preview
            originalRef.current = toSave;
            setAvatarUrl(photoUrlToSave || "");
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            setPreviewUrl("");
            setPendingFile(null);
            setEditMode(false);
        } catch (e) {
            console.error(e);
            alert("Não foi possível salvar o perfil. Tente novamente.");
        } finally {
            setUploading(false);
            setSaving(false);
        }
    }

    // tirar foto com câmera (fallback)
    async function startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user" }, // "environment" se quiser traseira
                audio: false,
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                // com autoPlay + playsInline normalmente não precisa,
                // mas manter este await ajuda em alguns Androids
                await videoRef.current.play().catch(() => { });
            }
            setTakingPhoto(true);
        } catch (e) {
            console.warn("getUserMedia indisponível:", e);
            alert(
                "Não foi possível acessar a câmera.\n" +
                "No iPhone, abra via Safari em HTTPS (ou localhost) e permita o acesso."
            );
        }
    }

    function stopCamera() {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.srcObject = null;
        }
    }

    // Caminho fixo no Storage
    const AVATAR_PATH = (uid) => `profiles/${uid}/avatar.jpg`;

async function downscaleImage(fileOrBlob, maxSide = 1024, quality = 0.7) {
  const file =
    fileOrBlob instanceof Blob
      ? fileOrBlob
      : fileOrBlob instanceof File
      ? fileOrBlob
      : null;
  if (!file) return fileOrBlob;

  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(maxSide / bitmap.width, maxSide / bitmap.height, 1);
  const w = Math.round(bitmap.width * ratio);
  const h = Math.round(bitmap.height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, w, h);

  const blob = await new Promise((res) =>
    canvas.toBlob(res, "image/jpeg", quality)
  );
  return blob || fileOrBlob;
}

    // Upload genérico (1 ÚNICO upload) + URL
    async function uploadAvatarAndGetUrl(uid, fileOrBlob) {
  const storageRef = ref(storage, AVATAR_PATH(uid));
  const smallBlob = await downscaleImage(fileOrBlob, 1024, 0.7);

  const file =
    smallBlob instanceof Blob
      ? new File([smallBlob], "avatar.jpg", { type: "image/jpeg" })
      : fileOrBlob;

  const snap = await uploadBytes(storageRef, file, {
    contentType: "image/jpeg",
  });
  return await getDownloadURL(snap.ref);
}

    // Escolheu arquivo da galeria
    function onFilePicked(e) {
        const file = e.target.files?.[0];
        console.log("[onFilePicked] file:", file);
        if (!file) return;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPendingFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        e.target.value = "";
    }

    // Tirar foto com a câmera
    async function capturePhoto() {
        if (!user || !videoRef.current) {
            alert("Sem usuário logado ou vídeo indisponível");
            return;
        }
        try {
            const video = videoRef.current;
            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth || 720;
            canvas.height = video.videoHeight || 720;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(video, 0, 0);
            const blob = await new Promise((res) =>
                canvas.toBlob(res, "image/jpeg", 0.8)
            );
            if (!blob) {
                alert("Falha ao capturar a foto (canvas.toBlob retornou null).");
                return;
            }

            setUploading(true);
            const url = await uploadAvatarAndGetUrl(user.uid, blob); // 1 upload só
            patch({ photoUrl: url });
        } catch (err) {
            console.error("[capturePhoto] erro:", err);
            alert("Erro ao salvar foto da câmera: " + (err?.message || err));
        } finally {
            setUploading(false);
            stopCamera();
            setTakingPhoto(false);
        }
    }

    // Sobe a foto escolhida da galeria (é chamada no onSave via persistAvatarIfNeeded)
    async function persistAvatarIfNeeded(uid) {
        if (!pendingFile) return null;
        try {
            setUploading(true);
            const url = await uploadAvatarAndGetUrl(uid, pendingFile);
            patch({ photoUrl: url });
            return url;
        } catch (err) {
            console.error("[persistAvatarIfNeeded] erro:", err);
            alert("Erro ao subir a foto: " + (err?.message || err));
            return null;
        } finally {
            setUploading(false);
            setPendingFile(null);
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
                setPreviewUrl("");
            }
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
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Meu perfil</h1>
                    <div className="flex gap-2">
                        <button
                            onClick={startEdit}
                            disabled={editMode}
                            className={`px-3 py-2 rounded bg-amber-600 hover:bg-amber-700 disabled:opacity-50`}
                        >
                            Editar
                        </button>
                        <button
                            onClick={onSave}
                            disabled={disableSaveCancel}
                            className={`px-3 py-2 rounded bg-green-600 hover:bg-green-700 disabled:opacity-50`}
                        >
                            Salvar
                        </button>
                        <button
                            onClick={cancelEdit}
                            disabled={disableSaveCancel}
                            className={`px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50`}
                        >
                            Cancelar
                        </button>
                    </div>
                </div>

                {/* FOTO */}
                <div className="bg-gray-800 rounded p-4">
                    <h2 className="text-xl font-semibold mb-3">Foto</h2>

                    <div className="flex items-center gap-4">
                        <img
                            src={
                                previewUrl ||
                                form.photoUrl ||
                                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                    form.nome || user?.email || "U"
                                )}&background=4f46e5&color=fff`
                            }
                            alt="avatar"
                            className="w-20 h-20 rounded-full object-cover border border-gray-600"
                        />

                        <div className="flex flex-col gap-2">
                            <input
  id="avatarFile"
  type="file"
  accept="image/*"
  capture="user"
  onChange={onFilePicked}
  disabled={!editMode}
  className="sr-only"
/>

<label
  htmlFor="avatarFile"
  className={`px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-700 cursor-pointer select-none ${
    !editMode ? "pointer-events-none opacity-50" : ""
  }`}
>
  Escolher foto
</label>

                            <button
                                type="button"
                                onClick={startCamera}
                                disabled={!editMode}
                                className="px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                            >
                                Tirar foto
                            </button>
                        </div>
                    </div>

                    {takingPhoto && (
                        <div className="mt-4 space-y-2">
                            <video
                                ref={videoRef}
                                className="w-full rounded border border-gray-700"
                                playsInline
                                muted
                                autoPlay
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={capturePhoto}
                                    className="px-3 py-2 rounded bg-green-600 hover:bg-green-700"
                                >
                                    {uploading ? "Salvando..." : "Capturar"}
                                </button>
                                <button
                                    onClick={() => { stopCamera(); setTakingPhoto(false); }}
                                    className="px-3 py-2 rounded bg-gray-700 hover:bg-gray-600"
                                >
                                    Cancelar câmera
                                </button>
                            </div>
                        </div>
                    )}
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
                            <input
                                className="w-full mt-1 p-2 rounded bg-gray-900 border border-gray-700"
                                value={idade || ""} disabled
                            />
                        </div>
                    </div> {/* <-- fecha a GRID */}
                </div> {/* <-- fecha a seção DADOS PESSOAIS */}


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
                                    <option key={uf} value={uf}>{uf}</option>
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


                {/* SAÚDE/OBJETIVO (opcional mas útil) */}
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
