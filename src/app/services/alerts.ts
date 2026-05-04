import { Injectable } from '@angular/core';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue } from "firebase/database";

const firebaseConfig = {
  apiKey: "YOUR_KEY",
  authDomain: "YOUR_AUTH",
  databaseURL: "YOUR_DB_URL",
  projectId: "YOUR_ID"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

@Injectable({
  providedIn: 'root',
})
export class Alerts {
  getAlerts(callback:any){
    const alertsRef = ref(db, 'alerts');

    onValue(alertsRef, (snapshot)=>{
      callback(snapshot.val());
    });
}
}
