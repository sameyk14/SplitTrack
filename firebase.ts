import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBAmC-cA-hm919NacfUWw1JWSVHpHFxL70",
  authDomain: "splittrack-b1537.firebaseapp.com",
  projectId: "splittrack-b1537",
  storageBucket: "splittrack-b1537.appspot.com",
  messagingSenderId: "307383728203",
  appId: "1:307383728203:web:ad7b190019f2c4ea81f5ce"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export default app;
