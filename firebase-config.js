import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc, 
    collection, 
    addDoc, 
    query, 
    where, 
    getDocs 
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

// Reemplazá los datos entre comillas con las claves reales de tu Firebase
const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "TU_PROYECTO.firebaseapp.com",
    projectId: "TU_PROYECTO",
    storageBucket: "TU_PROYECTO.appspot.com",
    messagingSenderId: "TUS_NUMEROS",
    appId: "TU_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export { 
    doc, 
    setDoc, 
    getDoc, 
    collection, 
    addDoc, 
    query, 
    where, 
    getDocs 
};
