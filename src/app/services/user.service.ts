import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private username = new BehaviorSubject<string>('');
  public username$: Observable<string> = this.username.asObservable();

  constructor() {}

  setUsername(username: string) {
    this.username.next(username);
  }

  getUsername() {
    return this.username.getValue();
  }
}
