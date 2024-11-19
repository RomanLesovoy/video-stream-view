import { isDevMode, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import io from 'socket.io-client';
import { DefineUserComponent } from './define-user-page/define-user.component';
import { UserDataGuard } from './guards/user-data.guard';
import { LoaderComponent } from './components/loader/loader.component';

const socketUrl = isDevMode() ? 'http://localhost:3000' : 'https://video-stream-server-arx0.onrender.com';

const routes = [
  {
    path: '',
    redirectTo: 'room',
    pathMatch: 'full'
  },
  {
    path: 'user-data',
    component: DefineUserComponent,
  },
  {
    path: 'room',
    canActivate: [UserDataGuard],
    loadChildren: () => import('./components/room/room.module').then(m => m.RoomModule)
  },
];

const socket = io(socketUrl, { transports: ['websocket'], autoConnect: true, reconnectionAttempts: 3 });

@NgModule({
  declarations: [AppComponent, DefineUserComponent],
  imports: [BrowserModule, FormsModule, RouterModule, LoaderComponent],
  providers: [
    provideHttpClient(),
    provideRouter(routes as Routes),
    { provide: 'socket', useValue: socket },
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
