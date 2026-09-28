# Portfolio

Next.js static-export portfolio with a Cloudflare Pages Functions editor API. GitHub remains the source repository; Cloudflare Pages serves the public site and runs the private editor endpoints.

## Run locally

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. Local development does not include a configured D1 database or Cloudflare secrets, so editor authentication and publishing work only after the Cloudflare resources below are configured.

## Cloudflare Pages setup

The previous editor passkey was embedded in client code and must be considered public. Choose a new, unique initial admin password; do not reuse the old passkey. This change removes it from the current source but does not rewrite existing Git history.

1. Create a Pages project from the `Chillbroz005/portfolio` GitHub repository and the `main` branch. Use Node.js 22, build command `npm ci && npm run build`, and output directory `out`. The static export is built at the domain root. The Wrangler configuration names the project `chillbroz005-portfolio`; if that name is unavailable, update `wrangler.toml` and `SITE_ORIGIN` together.
2. Create a D1 database named `portfolio-auth`, then run:

   ```bash
   npx wrangler d1 execute portfolio-auth --remote --file=migrations/0001_admin_auth.sql
   ```

3. In the Pages project settings, add a D1 binding named `DB` pointing to `portfolio-auth`. Add these encrypted secrets in **Settings > Variables and Secrets**:

   - `GITHUB_CONTENTS_TOKEN`: fine-grained token limited to this repository with Contents read/write access.
   - `RESEND_API_KEY`: API key from the Resend account.
   - `INITIAL_ADMIN_PASSWORD`: a temporary initial password of at least 12 characters. The first successful login stores its salted verifier in D1. Remove this secret after that login.

   Add these variables:

   - `ADMIN_EMAIL`: the private destination for password reset messages.
   - `RESEND_FROM`: sender address on a verified Resend domain.
   - `SITE_ORIGIN`: the exact HTTPS Cloudflare Pages origin, without a trailing path.

4. Redeploy the Pages project after creating the D1 binding and settings. Do not put secret values in this repository or in chat.

Password and recovery answers are stored only as salted PBKDF2-HMAC-SHA256 verifiers in D1. Reset emails expire after 15 minutes and can be used once; resetting also requires the configured security answer. A password can also be changed from editor settings. For an owner-operated emergency reset, set a new `INITIAL_ADMIN_PASSWORD` secret, delete the rows from `admin_sessions` and `admin_credentials` in the D1 console, sign in once with the new value, then remove the temporary secret.

The password and recovery-answer verifiers use 600,000 PBKDF2 iterations. Set the Pages Functions CPU limit high enough for this work; Cloudflare Workers Free currently allows 10 ms CPU per request, so a Workers Paid plan with a higher configured CPU limit may be required. [Cloudflare CPU limits](https://developers.cloudflare.com/workers/platform/limits/) ? [OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)

Resend requires an owned, verified sending domain before it will send reset email. Until that is configured, the in-site email reset cannot complete; the Cloudflare D1 reset procedure remains available. [Resend verified domains](https://resend.com/docs/dashboard/domains/introduction)

## GitHub publishing

The browser sends profile, resume, and optional photo files to the same-origin Pages Function. That function accepts only `src/data/profile.ts`, `public/resume.pdf`, and `public/profile-photo.png`, then uses `GITHUB_CONTENTS_TOKEN` to create one commit on `main`. The token is never sent to the browser.

Once the Cloudflare Pages site and editor have been configured and verified, disable the existing GitHub Pages deployment workflow in `.github/workflows/deploy.yml`. The public address will be the Cloudflare Pages address; the old `github.io/portfolio` URL is not retained without a custom domain.

Before cutover, publish any pending edits from the old site. Browser-only drafts and the old browser-stored GitHub token do not migrate automatically.

## Source-of-truth rule

Do not add personal facts, metrics, project results, certifications, social URLs, or repository information unless verified against the resume or another supplied source.
