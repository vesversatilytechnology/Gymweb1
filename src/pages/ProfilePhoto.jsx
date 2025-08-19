import { useEffect, useRef, useState } from "react";
import { auth, db, storage } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import Cropper from "react-easy-crop";
import { useNavigate, Link } from "react-router-dom";

const AVATAR_PATH = (uid) => `uploads/${uid}/avatar.jpg`;

export default function ProfilePhoto() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => auth.currentUser);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [photoUrl, setPhotoUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");   // imagem em edição/preview
  const [pendingFile, setPendingFile] = useState(null);

  // cropper
  const [showCropper, setShowCropper] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState(null);

  // câmera
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [takingPhoto, setTakingPhoto] = useState(false);

  const [toast, setToast] = useState(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) { navigate("/"); return; }
      setUser(u);
      try {
        const snap = await getDoc(doc(db, "profiles", u.uid));
        const url = snap.exists() ? (snap.data().photoUrl || "") : "";
        setPhotoUrl(url);
      } finally {
        setLoading(false);
      }
    });
    return () => {
      unsub();
      stopCamera(); // garante que a câmera é desligada ao desmontar
    };
  }, [navigate]);

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  // ==== util: gerar blob cortado a partir do preview + área
  async function getCroppedBlob(imageSrc, cropPx) {
    const original = await (await fetch(imageSrc)).blob();
    const bitmap = await createImageBitmap(original);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(cropPx.width);
    canvas.height = Math.round(cropPx.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(
      bitmap,
      cropPx.x, cropPx.y, cropPx.width, cropPx.height,
      0, 0, canvas.width, canvas.height
    );
    return await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.9));
  }

  async function downscaleImage(fileOrBlob, maxSide = 1024, quality = 0.7) {
    const blob = fileOrBlob instanceof Blob ? fileOrBlob : null;
    if (!blob) return fileOrBlob;
    const bmp = await createImageBitmap(blob);
    const ratio = Math.min(maxSide / bmp.width, maxSide / bmp.height, 1);
    const w = Math.round(bmp.width * ratio);
    const h = Math.round(bmp.height * ratio);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bmp, 0, 0, w, h);
    return await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
  }

  async function uploadAndGetUrl(uid, fileOrBlob) {
    const storageRef = ref(storage, AVATAR_PATH(uid));
    const small = await downscaleImage(fileOrBlob, 1024, 0.7);
    const file =
      small instanceof Blob ? new File([small], "avatar.jpg", { type: "image/jpeg" }) : fileOrBlob;

    const snap = await uploadBytes(storageRef, file, {
      contentType: "image/jpeg",
      cacheControl: "no-store",
    });
    const url = await getDownloadURL(snap.ref);
    try { await updateProfile(auth.currentUser, { photoURL: url }); } catch { /* no-op */ }
    return url;
  }

  // ==== eventos de arquivo (galeria)
  function onFilePicked(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setPendingFile(file);
    setShowCropper(true);
    e.target.value = "";
  }

  // ==== cropper
  async function applyCrop() {
    if (!previewUrl || !croppedArea) return;
    const blob = await getCroppedBlob(previewUrl, croppedArea);
    const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
    setPendingFile(file);
    URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(blob));
    setShowCropper(false);
  }
  function cancelCrop() { setShowCropper(false); }

  // ==== Câmera
  async function startCamera() {
    try {
      // 1) renderiza o <video> imediatamente
      setTakingPhoto(true);

      // 2) dá um "tick" para garantir que o videoRef já exista
      await new Promise((r) => setTimeout(r, 0));

      // 3) pede a câmera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;

      // 4) anexa ao <video> e dá play
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (e) {
      console.warn("getUserMedia falhou:", e);
      alert(
        "Não foi possível acessar a câmera.\n" +
        "No iPhone, abra via Safari em HTTPS (ou localhost) e permita o acesso."
      );
      setTakingPhoto(false);
    }
  }

  function stopCamera() {
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {}
    streamRef.current = null;
    if (videoRef.current) {
      try { videoRef.current.pause(); } catch {}
      videoRef.current.srcObject = null;
    }
  }

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

      const url = URL.createObjectURL(blob);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPendingFile(new File([blob], "camera.jpg", { type: "image/jpeg" }));
      setPreviewUrl(url);
      setShowCropper(true);
    } catch (err) {
      console.error("[capturePhoto] erro:", err);
      alert("Erro ao capturar a foto: " + (err?.message || err));
    } finally {
      stopCamera();
      setTakingPhoto(false);
    }
  }

  // ==== salvar
  async function onSave() {
    if (!user) return;
    setSaving(true);
    try {
      let finalUrl = photoUrl;
      if (pendingFile) {
        finalUrl = await uploadAndGetUrl(user.uid, pendingFile);
      }
      await setDoc(
        doc(db, "profiles", user.uid),
        { photoUrl: finalUrl, updatedAt: serverTimestamp() },
        { merge: true }
      );
      setPhotoUrl(finalUrl);
      setPendingFile(null);
      if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(""); }
      setToast(true);
      setTimeout(() => setToast(false), 1800);
    } catch (e) {
      console.error(e);
      alert("Falha ao salvar foto.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <div className="max-w-3xl mx-auto">Carregando…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      {toast && (
        <div className="fixed top-4 right-4 bg-emerald-600 text-white px-4 py-2 rounded shadow-lg">
          Salvo!
        </div>
      )}

      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Foto do perfil</h1>
          <div className="flex gap-2">
            <Link to="/profile" className="px-3 py-2 rounded bg-gray-700 hover:bg-gray-600">
              Voltar
            </Link>
            <button
              onClick={onSave}
              disabled={saving}
              className="px-3 py-2 rounded bg-green-600 hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>

        <div className="bg-gray-800 rounded p-4">
          <h2 className="text-xl font-semibold mb-3">Foto</h2>

          <div className="flex items-center gap-4">
            <img
              src={
                previewUrl ||
                photoUrl ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.email || "U")}&background=4f46e5&color=fff`
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
                className="sr-only"
              />
              <label
                htmlFor="avatarFile"
                className="px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-700 cursor-pointer select-none"
              >
                Escolher foto
              </label>

              <button
                type="button"
                onClick={startCamera}
                className="px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-700"
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
                <button onClick={capturePhoto} className="px-3 py-2 rounded bg-green-600 hover:bg-green-700">
                  Capturar
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
      </div>

      {/* Modal do Cropper */}
      {showCropper && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-xl w-full max-w-lg overflow-hidden">
            <div className="relative h-80 bg-black">
              <Cropper
                image={previewUrl}
                crop={crop}
                zoom={zoom}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, px) => setCroppedArea(px)}
                aspect={1}
                cropShape="round"
                showGrid={false}
              />
            </div>
            <div className="p-3 flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1"
              />
              <button onClick={cancelCrop} className="px-3 py-2 rounded bg-gray-700 hover:bg-gray-600">
                Cancelar
              </button>
              <button onClick={applyCrop} className="px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-700">
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}