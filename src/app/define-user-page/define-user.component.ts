import { Component, OnInit } from '@angular/core';
import { UserService } from '../services/user.service';
import { Router, ActivatedRoute, ParamMap } from '@angular/router';

@Component({
  selector: 'app-define-user',
  templateUrl: './define-user.component.html',
  styleUrl: './define-user.component.scss'
})
export class DefineUserComponent implements OnInit {
  username: string = '';
  redirectTo = '';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private userService: UserService,
  ) {}

  ngOnInit() {
    this.route.queryParamMap.subscribe((params: ParamMap) => {
      this.redirectTo = params.get('redirectTo') || '';
    });

    if (this.userService.getUsername().length) {
      this.router.navigate([this.redirectTo]);
    }
  }

  setUsername() {
    if (this.username.trim() && this.username.trim().length > 2) {
      this.userService.setUsername(this.username);
      setTimeout(() => {
        this.router.navigate([this.redirectTo]);
      }, 200)
    }
  }
}
