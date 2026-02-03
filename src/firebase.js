// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: 'AIzaSyAG0JcIsi3EM-oPBJDGbXgFsyEzOiPj6JU',
  authDomain: 'piscina-sanbuenaventura.firebaseapp.com',
  projectId: 'piscina-sanbuenaventura',
  storageBucket: 'piscina-sanbuenaventura.firebasestorage.app',
  messagingSenderId: '268002661660',
  appId: '1:268002661660:web:b9a4f268814f5d20f6d6d9',
  measurementId: 'G-BVS3XXW72N',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
