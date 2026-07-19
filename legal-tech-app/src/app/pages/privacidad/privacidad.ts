import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';

@Component({
  selector: 'app-privacidad',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './privacidad.html',
  styleUrls: ['./privacidad.scss']
})
export class PrivacidadComponent {
  private router = inject(Router);

  goBack() {
    this.router.navigate(['/']);
  }
}
