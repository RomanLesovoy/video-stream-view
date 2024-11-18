import { Injectable } from '@angular/core';
import { 
  CanActivate, 
  CanActivateChild,
  Router, 
  UrlTree 
} from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { UserService } from '../services/user.service';

@Injectable({
  providedIn: 'root'
})
export class UserDataGuard implements CanActivate, CanActivateChild {
  constructor(
    private userService: UserService,
    private router: Router
  ) {}

  canActivate(): Observable<boolean | UrlTree> {
    return this.userService.username$.pipe(
      map(username => {
        if (username.trim().length > 2) {
          return true;
        }
        return this.router.createUrlTree(['/user-data']);
      })
    );
  }

  canActivateChild(): Observable<boolean | UrlTree> {
    return this.canActivate();
  }
}
