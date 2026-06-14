/**
 * firebase-init.js
 * File DUY NHẤT khởi tạo Firebase — mọi file khác import từ đây.
 * Tránh lỗi "Firebase App named '[DEFAULT]' already exists"
 */
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth }       from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore }  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyDP7nkvjEafM8XIVQlnl3c3hp4bHgN3Vc8",
  authDomain:        "spck-tuyenjsi-10.firebaseapp.com",
  projectId:         "spck-tuyenjsi-10",
  storageBucket:     "spck-tuyenjsi-10.firebasestorage.app",
  messagingSenderId: "849414542869",
  appId:             "1:849414542869:web:095821d5e0de71c3bf201c",
  measurementId:     "G-BHXFRP2KG1"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db   = getFirestore(app);
