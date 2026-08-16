import { defineAuth, secret } from '@aws-amplify/backend';

/**
 * Email/password (with the built-in forgot-password flow) plus Google
 * sign-in. Facebook is deliberately not wired up yet — deferred until its
 * app review is done. Callback/logout URLs cover both local dev and the
 * eventual production domain; add more here if a preview/staging URL
 * shows up later.
 * @see https://docs.amplify.aws/gen2/build-a-backend/auth
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
    externalProviders: {
      google: {
        clientId: secret('GOOGLE_CLIENT_ID'),
        clientSecret: secret('GOOGLE_CLIENT_SECRET'),
      },
      callbackUrls: ['http://localhost:5173/', 'https://line.klet.app/'],
      logoutUrls: ['http://localhost:5173/', 'https://line.klet.app/'],
    },
  },
});
