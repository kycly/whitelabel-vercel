import type { CognitoUserSession } from "amazon-cognito-identity-js";
import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserPool,
} from "amazon-cognito-identity-js";
import { publicEnv } from "@/config/public-env";

let pendingNewPasswordUser: CognitoUser | null = null;

const userPool = new CognitoUserPool({
  UserPoolId: publicEnv.cognitoUserPoolId,
  ClientId: publicEnv.cognitoAppClientId,
});

export type CognitoAuthResult = {
  idToken: string;
  accessToken: string;
  username: string;
};

export type CognitoCodeDelivery = {
  deliveryMedium: string | null;
  destination: string | null;
};

export async function cognitoSignIn(username: string, password: string): Promise<CognitoAuthResult> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: username, Pool: userPool });
    const authDetails = new AuthenticationDetails({ Username: username, Password: password });

    user.authenticateUser(authDetails, {
      onSuccess(session: CognitoUserSession) {
        resolve({
          idToken: session.getIdToken().getJwtToken(),
          accessToken: session.getAccessToken().getJwtToken(),
          username,
        });
      },
      onFailure(error: Error) {
        reject(error);
      },
      newPasswordRequired() {
        pendingNewPasswordUser = user;
        reject(new Error("NEW_PASSWORD_REQUIRED"));
      },
    });
  });
}

export function cognitoSignOut(): void {
  userPool.getCurrentUser()?.signOut();
  pendingNewPasswordUser = null;
}

export async function getExistingSession(): Promise<CognitoAuthResult | null> {
  return new Promise((resolve) => {
    const user = userPool.getCurrentUser();

    if (!user) {
      resolve(null);
      return;
    }

    user.getSession((error: Error | null, session: CognitoUserSession | null) => {
      if (error || !session?.isValid()) {
        resolve(null);
        return;
      }

      resolve({
        idToken: session.getIdToken().getJwtToken(),
        accessToken: session.getAccessToken().getJwtToken(),
        username: user.getUsername(),
      });
    });
  });
}

export async function cognitoCompleteNewPassword(newPassword: string): Promise<CognitoAuthResult> {
  return new Promise((resolve, reject) => {
    if (!pendingNewPasswordUser) {
      reject(new Error("NO_PENDING_NEW_PASSWORD_CHALLENGE"));
      return;
    }

    const user = pendingNewPasswordUser;

    user.completeNewPasswordChallenge(newPassword, {}, {
      onSuccess(session: CognitoUserSession) {
        pendingNewPasswordUser = null;
        resolve({
          idToken: session.getIdToken().getJwtToken(),
          accessToken: session.getAccessToken().getJwtToken(),
          username: user.getUsername(),
        });
      },
      onFailure(error: Error) {
        reject(error);
      },
    });
  });
}

export async function cognitoStartForgotPassword(username: string): Promise<CognitoCodeDelivery> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: username, Pool: userPool });

    user.forgotPassword({
      onSuccess() {
        resolve({
          deliveryMedium: null,
          destination: null,
        });
      },
      onFailure(error: Error) {
        reject(error);
      },
      inputVerificationCode(data?: { DeliveryMedium?: string; Destination?: string }) {
        resolve({
          deliveryMedium: data?.DeliveryMedium ?? null,
          destination: data?.Destination ?? null,
        });
      },
    });
  });
}

export async function cognitoConfirmForgotPassword(
  username: string,
  code: string,
  newPassword: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: username, Pool: userPool });

    user.confirmPassword(code, newPassword, {
      onSuccess() {
        resolve();
      },
      onFailure(error: Error) {
        reject(error);
      },
    });
  });
}