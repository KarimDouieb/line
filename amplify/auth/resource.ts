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
    // Cognito reuses this same template for both the sign-up confirmation
    // code and the forgot-password code (there's no separate template for
    // each without a custom-message Lambda trigger), hence wording generic
    // enough to make sense for either. This only fixes clarity/branding —
    // it still sends through Cognito's own shared address, not SES, so it
    // won't by itself change spam-folder placement.
    email: {
      verificationEmailSubject: 'Your Line verification code',
      verificationEmailBody: (createCode: () => string) =>
        `Your Line verification code is ${createCode()}.\n\nEnter it in the app to continue (https://line.klet.app). If you didn't request this, you can safely ignore this email, no changes will be made to your account.`,
    },
    externalProviders: {
      google: {
        clientId: secret('GOOGLE_CLIENT_ID'),
        clientSecret: secret('GOOGLE_CLIENT_SECRET'),
        // CDK's UserPoolIdentityProviderGoogle defaults to requesting only
        // the "profile" scope — without "email" here, Google never returns
        // an email claim, and Cognito rejects the new user for missing its
        // required `email` attribute (Cognito's attribute mapping for it is
        // already configured automatically; there's just nothing to map).
        scopes: ['email', 'profile'],
      },
      callbackUrls: ['http://localhost:5173/', 'https://line.klet.app/'],
      logoutUrls: ['http://localhost:5173/', 'https://line.klet.app/'],
    },
  },
});
