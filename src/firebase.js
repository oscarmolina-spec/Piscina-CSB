import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// ⚠️ SUSTITUYE ESTE BLOQUE POR TUS CLAVES (Las que copiaste de Google)
const firebaseConfig = {
  apiKey: "AIzaSyAG0JcIsi3EM-oPBJDGbXgFsyEzOiPj6JU",
  authDomain: "piscina-sanbuenaventura.firebaseapp.com",
  projectId: "piscina-sanbuenaventura",
  storageBucket: "piscina-sanbuenaventura.firebasestorage.app",
  messagingSenderId: "268002661660",
  appId: "1:268002661660:web:b9a4f268814f5d20f6d6d9",
  measurementId: "G-BVS3XXW72N"
};

// Iniciamos las herramientas que usa la App
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ¡Esto es lo importante! Exportamos la base de datos y la autenticación
export { db, auth };