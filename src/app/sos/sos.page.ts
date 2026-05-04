import { Component } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sos',
  standalone: true,
  imports: [IonicModule, CommonModule],
  templateUrl: './sos.page.html'
})
export class SosPage {
  sendSOS() {
    console.log("SOS SENT");
  }
}