import { Component } from '@angular/core';
import { GuardsCheckStart, GuardsCheckEnd, NavigationCancel, Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'stream-frontend';
  loading: boolean = true;

  constructor(private router: Router) {
    this.router.events.subscribe((event: any) => {
      if (event instanceof GuardsCheckStart) {
        this.loading = true;
      }     
      if (event instanceof GuardsCheckEnd || event instanceof NavigationCancel) {
        setTimeout(() => {
          this.loading = false;
        }, 1000);
      } 
    });
  }
}
