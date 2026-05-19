export const LOCAL_APP_ENV = "local";

export const publicEnv = {
  appEnv: process.env.NEXT_PUBLIC_APP_ENV ?? LOCAL_APP_ENV,
  awsRegion: process.env.NEXT_PUBLIC_AWS_REGION ?? "eu-west-1",
  cognitoAppClientId: process.env.NEXT_PUBLIC_COGNITO_APP_CLIENT_ID ?? "local-dev-client",
  cognitoUserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "eu-west-1_local",
} as const;