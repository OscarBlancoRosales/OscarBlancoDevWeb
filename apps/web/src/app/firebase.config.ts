import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBKgvbiuEbrrPh03LQslFuhGvwAImjuEuc",
  authDomain: "oscarblanco-scrum-poker.firebaseapp.com",
  databaseURL: "https://oscarblanco-scrum-poker-default-rtdb.europe-west1.firebasedatabase.app/",
  projectId: "oscarblanco-scrum-poker",
  storageBucket: "oscarblanco-scrum-poker.firebasestorage.app",
  messagingSenderId: "488624431704",
  appId: "1:488624431704:web:acfabbbb6ed06b0061602d",
  measurementId: "G-DK2EEV2HV0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
export const auth = getAuth(app);
