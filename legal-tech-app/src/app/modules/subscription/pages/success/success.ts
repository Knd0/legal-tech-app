import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-subscription-success',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './success.html'
})
export class Success {
  constructor() {}
}
