import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { user } from '@angular/fire/auth';
import { map } from 'rxjs/operators';

export const authGuard: CanActivateFn = (): any => {
  const auth = inject(Auth);
  const router = inject(Router);
  return user(auth).pipe(map(u => (u ? true : router.createUrlTree(['/login']))));
};




