// src/services/auth/firebase-config.ts
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// AsyncStorage será usado apenas se disponível (para persistência de sessão)
let AsyncStorage: any = null;
try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (e) {
  // AsyncStorage não está disponível, continuar sem persistência automática
  console.warn(
    'AsyncStorage não encontrado. Persistência de sessão pode não funcionar.'
  );
}

// Configuração do Firebase
// ⚠️ IMPORTANTE: As credenciais abaixo são do projeto inpunto-46140
// No React Native CLI, não temos acesso a process.env, então usamos valores fixos
// https://console.firebase.google.com/project/inpunto-46140
const firebaseConfig = {
  apiKey: 'AIzaSyDwGuIvz1_GZ9IwN1d4_hWcEeUO2JETw4c',
  authDomain: 'inpunto-46140.firebaseapp.com',
  projectId: 'inpunto-46140',
  storageBucket: 'inpunto-46140.firebasestorage.app',
  messagingSenderId: '316827163539',
  appId: '1:316827163539:android:f32a1772aef3f1cab56666',
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

export const initializeFirebase = (): void => {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    const existingApp = getApps()[0];
    if (existingApp) {
      app = existingApp;
    } else {
      app = initializeApp(firebaseConfig);
    }
  }

  // Inicializar Auth
  if (!auth && app) {
    auth = getAuth(app);
    // Firebase mantém persistência automaticamente em React Native/Expo
  }

  // Inicializar Firestore
  if (!db && app) {
    db = getFirestore(app);
  }
};

export const getFirebaseApp = (): FirebaseApp => {
  if (!app) {
    initializeFirebase();
  }
  return app!;
};

export const getFirebaseAuth = (): Auth => {
  if (!auth) {
    initializeFirebase();
  }
  return auth!;
};

export const getFirebaseDb = (): Firestore => {
  if (!db) {
    initializeFirebase();
  }
  return db!;
};

// Inicializar automaticamente
// Usar try-catch para não bloquear a inicialização do app em caso de erro de rede
try {
  initializeFirebase();
} catch (error) {
  // Log do erro mas não bloqueia a inicialização
  console.warn(
    'Erro ao inicializar Firebase na inicialização automática:',
    error
  );
}
