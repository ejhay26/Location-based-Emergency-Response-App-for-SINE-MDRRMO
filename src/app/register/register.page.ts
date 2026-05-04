import { Component } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
  templateUrl: './register.page.html'
})
export class RegisterPage {
  first = '';
  last = '';
  phone = '';
  email = '';
  password = '';

  register() {
    console.log(this.first, this.last);
  }
}