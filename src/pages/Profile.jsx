import { useEffect, useMemo, useRef, useState } from "react";
import { auth, db, storage } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useNavigate } from "react-router-dom";

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

  const persistAvatarIfNeeded = async (uid) => {
    if (!pendingFile) return null;
    setUploading(true);
    try {
      const url = await uploadAvatarAndGetUrl(uid, pendingFile);
      setAvatarUrl(url);
      await setDoc(
        doc(db, "profiles", uid),
        { photoUrl: url, updatedAt: serverTimestamp() },
        { merge: true }
      );
      return url;
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // dados do perfil no formulário
  const [form, setForm] = useState({
    nome: "",
    endereco: "",
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
      // sobe a foto da galeria se o usuário tiver escolhido uma
    const uploadedUrl = await persistAvatarIfNeeded(user.uid);
    if (uploadedUrl) patch({ photoUrl: uploadedUrl });

    const toSave = {
      ...form,
      email: user.email || form.email,
      updatedAt: serverTimestamp(),
    };

    await setDoc(doc(db, "profiles", user.uid), toSave, { merge: true });
    originalRef.current = toSave;

    // limpa estado de preview após salvar com sucesso
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
    }
    setPendingFile(null);
    
    setEditMode(false);
  } catch (e) {
    console.error(e);
    alert("Não foi possível salvar o perfil. Tente novamente.");
  } finally {
    setSaving(false);
  }
}

  // upload da imagem (galeria/pc)
  function onFilePicked(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl); // libera preview antigo
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  // tirar foto com câmera (fallback)
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setTakingPhoto(true);
    } catch (e) {
      console.warn("getUserMedia indisponível:", e);
      alert("Não foi possível acessar a câmera.");
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

  // Caminho fixo para o avatar no Storage
  const AVATAR_PATH = (uid) => `profiles/${uid}/avatar.jpg`;

  // Função genérica que faz o upload e retorna a URL
  const uploadAvatarAndGetUrl = async (uid, file) => {
    const storageRef = ref(storage, AVATAR_PATH(uid));
    await uploadBytes(storageRef, file, { contentType: file.type || "image/jpeg" });
    return await getDownloadURL(storageRef);
  };

  // Tirar foto com a câmera
  async function capturePhoto() {
    if (!user || !videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.9));

    const storageRef = ref(storage, AVATAR_PATH(user.uid));
    await uploadBytes(storageRef, blob);
    const url = await uploadAvatarAndGetUrl(user.uid, blob);
    patch({ photoUrl: url });
    stopCamera();
    setTakingPhoto(false);
  }

  // Salvar foto da galeria
  async function savePendingPhoto() {
    if (!pendingFile || !user) return;
    const url = await uploadAvatarAndGetUrl(user.uid, pendingFile);
    patch({ photoUrl: url });
    setPendingFile(null);
    setPreviewUrl("");
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
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={onFilePicked}
                  className="hidden"
                  disabled={!editMode}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!editMode}
                  className="px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                >
                  Escolher foto
                </button>

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

          {/* preview da câmera */}
          {takingPhoto && (
            <div className="mt-4 space-y-2">
              <video 
                ref={videoRef} 
                className="w-full rounded border border-gray-700" 
              />
              <div className="flex gap-2">
                <button
                  onClick={capturePhoto}
                  className="px-3 py-2 rounded bg-green-600 hover:bg-green-700"
                >
                  Capturar
                </button>
                <button
                  onClick={() => {
                    stopCamera();
                    setTakingPhoto(false);
                  }}
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
                disabled // email vem do auth
              />
            </div>

            <div>
              <label className="text-sm text-gray-300">Telefone</label>
              <input
                className="w-full mt-1 p-2 rounded bg-gray-900 border border-gray-700"
                value={form.telefone}
                onChange={(e) => patch({ telefone: e.target.value })}
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
                value={idade || ""}
                disabled
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm text-gray-300">Endereço</label>
              <input
                className="w-full mt-1 p-2 rounded bg-gray-900 border border-gray-700"
                value={form.endereco}
                onChange={(e) => patch({ endereco: e.target.value })}
                disabled={!editMode}
                placeholder="Rua, número, bairro, cidade"
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
                <option>Resistência</option>
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
                onChange={(e) =>
                  patch({ contatoEmergenciaTelefone: e.target.value })
                }
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
