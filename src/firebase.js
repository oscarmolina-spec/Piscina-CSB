import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyAG0JcIsi3EM-oPBJDGbXgFsyEzOiPj6JU',
  authDomain: 'piscina-sanbuenaventura.firebaseapp.com',
  projectId: 'piscina-sanbuenaventura',
  storageBucket: 'piscina-sanbuenaventura.firebasestorage.app',
  messagingSenderId: '268002661660',
  appId: '1:268002661660:web:b9a4f268814f5d20f6d6d9',
  measurementId: 'G-BVS3XXW72N'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Permite crear una cuenta de personal sin cerrar la sesión del administrador.
const secondaryApp = initializeApp(firebaseConfig, 'staff-creation');
const secondaryAuth = getAuth(secondaryApp);

export { db, auth, secondaryAuth };