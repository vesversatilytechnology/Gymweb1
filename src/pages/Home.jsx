import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";

export default function Home() {
    const [nome, setNome] = useState("");
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                navigate("/");
                return;
            }
            try {
                const snap = await getDoc(doc(db, "profiles", user.uid));
                if (snap.exists()) setNome(snap.data().nome || "");
            } catch { }
            setLoading(false);
        });
        return () => unsub();
    }, [navigate]);

    const handleLogout = async () => {
        await signOut(auth);
        navigate("/");
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
            <div className="max-w-3xl mx-auto">
                <div className="mb-2 text-gray-300">
                    {nome ? <>Olá, <span className="font-semibold">{nome}</span> 👋</> : "Olá 👋"}
                </div>

                

                <div className="bg-gray-800 rounded p-4 mb-4">
                    <p className="text-gray-300">
                        Monitore seus treinos, assista aos vídeos e registre cada conquista.
                    </p>
                    <div className="mt-4 flex gap-3">
                        <Link
                            to="/dashboard"
                            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
                        >
                            Meus treinos
                        </Link>
                        <button
                            onClick={handleLogout}
                            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded"
                        >
                            Sair
                        </button>
                    </div>
                </div>

                {/* Espaço para cards rápidos no futuro */}
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-gray-800 rounded p-4">
                        <h3 className="font-semibold mb-2">Próximo treino</h3>
                        <p className="text-gray-400">Você ainda não concluiu o treino desta semana.</p>
                    </div>
                    <div className="bg-gray-800 rounded p-4">
                        <h3 className="font-semibold mb-2">Mensagens</h3>
                        <p className="text-gray-400">Nenhuma mensagem do treinador por enquanto.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}