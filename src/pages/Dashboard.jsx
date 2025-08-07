import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
} from "firebase/firestore";

export default function Dashboard() {
  const [treino, setTreino] = useState(null);
  const [exercicios, setExercicios] = useState([]);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  useEffect(() => {
    const carregarTreino = async () => {
      // Pegando o primeiro treino cadastrado
      const treinosRef = collection(db, "treinos");
      const snapshot = await getDocs(treinosRef);

      if (!snapshot.empty) {
        const primeiroTreino = snapshot.docs[0];
        setTreino(primeiroTreino.data());

        // Pegando subcoleção "exercicios"
        const exerciciosRef = collection(primeiroTreino.ref, "exercicios");
        const exerciciosSnap = await getDocs(exerciciosRef);

        const lista = exerciciosSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setExercicios(lista);
      }
    };

    carregarTreino();
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">
          {treino ? treino.titulo : "Carregando treino..."}
        </h1>
        <p className="text-gray-400 mb-8">{treino?.descricao}</p>

        {exercicios.map((ex) => (
          <div
            key={ex.id}
            className="bg-gray-800 p-4 rounded mb-6 shadow-md"
          >
            <h2 className="text-xl font-semibold mb-2">{ex.nome}</h2>
            <p className="mb-2">Séries: {ex.series}</p>
            {ex.videoUrl && (
              <div className="aspect-video mb-3">
                <iframe
                  className="w-full h-full rounded"
                  src={ex.videoUrl}
                  title={ex.nome}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
            )}
            <button className="bg-green-600 px-4 py-2 rounded hover:bg-green-700">
              Concluir exercício
            </button>
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