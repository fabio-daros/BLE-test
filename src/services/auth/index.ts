// src/services/auth/index.ts
export { authService, AuthService } from './auth-service';
export { phoneAuthService, PhoneAuthService } from './phone-auth-service';
export { googleAuthService, GoogleAuthService } from './google-auth-service';
export { clerkAuthService, ClerkAuthService } from './clerk-auth-service';
export {
  firebaseFunctionsService,
  FirebaseFunctionsService,
} from './firebase-functions-service';
export {
  initializeFirebase,
  getFirebaseAuth,
  getFirebaseDb,
} from './firebase-config';
export type {
  AuthUser,
  CreateAccountData,
  LoginCredentials,
} from './auth-service';
export type { PhoneAuthResult } from './phone-auth-service';
