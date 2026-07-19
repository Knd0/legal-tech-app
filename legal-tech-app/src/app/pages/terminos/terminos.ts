import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';

@Component({
  selector: 'app-terminos',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './terminos.html',
  styleUrls: ['./terminos.scss']
})
export class TerminosComponent {
  private router = inject(Router);

  goBack() {
    this.router.navigate(['/']);
  }
}
