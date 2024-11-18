import { Component, OnInit } from '@angular/core';
import { UserService } from '../services/user.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-define-user',
  templateUrl: './define-user.component.html',
  styleUrl: './define-user.component.scss'
})
export class DefineUserComponent implements OnInit {
  username: string = ''

  constructor(
    private router: Router,
    private userService: UserService,
  ) {}

  ngOnInit() {
    if (this.userService.getUsername().length) {
      this.router.navigate(['/room']);
    }
  }

  setUsername() {
    if (this.username.trim() && this.username.trim().length > 2) {
      this.userService.setUsername(this.username);
      setTimeout(() => {
        this.router.navigate(['/room']);
      }, 200)
    }
  }
}
