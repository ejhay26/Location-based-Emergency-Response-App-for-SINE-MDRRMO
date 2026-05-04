import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class LoginPage {
  email = '';
  password = '';

  constructor() {}

  login() {
    // This will print the email and password to your F12 Console when clicked!
    // Later, we will send this data to your Laravel API.
    console.log('Attempting login with:', this.email, this.password);
  }
}