// Thin React binding for LoginController (feature 001). The controller holds the logic (tested
// separately); this hook just mirrors its state into React and exposes the actions.

import { useEffect, useRef, useState } from 'react';
import {
  Credentials,
  LoginController,
  LoginControllerDeps,
} from './loginController';
import { LoginState, initialLoginState } from './loginMachine';
import type { AuthMethod } from '../../../services/isds/types';

export type UseLoginControllerDeps = Omit<LoginControllerDeps, 'onChange'>;

export interface LoginActions {
  state: LoginState;
  start: (input: Credentials) => Promise<void>;
  retryWithMethod: (method: AuthMethod) => Promise<void>;
  submitOtp: (code: string) => Promise<void>;
  resendSms: () => Promise<void>;
  cancel: () => void;
  retry: () => void;
}

export function useLoginController(deps: UseLoginControllerDeps): LoginActions {
  const [state, setState] = useState<LoginState>(initialLoginState);
  const ref = useRef<LoginController | null>(null);
  if (ref.current === null) {
    ref.current = new LoginController({ ...deps, onChange: setState });
  }
  const c = ref.current;
  // Leaving the screen ends the sign-in it was on (`LoginController.dispose`).
  useEffect(() => () => c.dispose(), [c]);
  return {
    state,
    start: input => c.start(input),
    retryWithMethod: method => c.retryWithMethod(method),
    submitOtp: code => c.submitOtp(code),
    resendSms: () => c.resendSms(),
    cancel: () => c.cancel(),
    retry: () => c.retry(),
  };
}
