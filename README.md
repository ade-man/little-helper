# Little Helpers

A tablet-friendly pocket-money adventure for a child, with a separate parent dashboard. Built with dependency-free JavaScript, Supabase Auth/Postgres, and a Netlify Functions backend. A Supabase Edge Function adapter is also included for the hosted version.

## What works

- A child ticks off essential routines and homework, then sends them for parent approval.
- Each approved essential earns one star. The configurable weekly threshold unlocks paid extra jobs.
- Daily tasks can be claimed once per calendar day; weekly tasks once per Monday–Sunday week.
- Parents approve jobs, send them back with a kind note, add/edit/remove tasks, and set monetary rewards in pennies.
- Approved extra jobs add to the weekly pot. Pending jobs never count as earned money.
- Weekly progress, a savings goal, spoken task descriptions, and celebrations encourage helping as part of the family team.
- Read-aloud defaults to a gentle pace and softer volume, preferring an available natural/enhanced British English voice. Tap **Voice** on the child's adventure or open **Family settings → Read-aloud voice** to preview and choose a voice, pace and volume. Preferences are saved on that device; choose on the daughter's tablet to affect what she hears. Voices vary by browser/device, and more English voices may be available in the tablet's accessibility/speech settings. No family data or reward rules change when choosing a voice.
- In **My money → Choose my dream toy**, children paste a product link to import its name, picture, description and GBP price, check an editable preview, then save it as their target. The saved price is a snapshot, not a live quote. The demo offers an illustrated example toy.
- Payouts are a record of money handed over by a parent. There are no bank connections or transfers.
- Secure parent login, one-time child-tablet pairing links, device revocation, and cross-device updates every 30 seconds.

## Current hosted setup

Supabase project: `little-helpers` (`iuokuddczsrgvneqnaqn`), in Allenby Systems, London region.

The hosted app uses the `little-helpers-api` Supabase Edge Function, with public configuration in `dist/runtime.json`. This file contains a publishable key, which is intended for browser use. Backend secret keys are never included in source or static assets.

- App: https://little-helpers-family-quest.plainpapaya4.chatgpt.site
- Sample adventure: https://little-helpers-family-quest.plainpapaya4.chatgpt.site/?demo=1
- Supabase dashboard: https://supabase.com/dashboard/project/iuokuddczsrgvneqnaqn
- Live Netlify app: https://pocket-money-helper.netlify.app

The sample adventure saves its own example progress in browser storage. It never writes to the live database. Live family accounts start fresh.

The parent dashboard has its own dark navigation and explicit **PARENT AREA** header, with **Review jobs**, **Tasks & rewards**, **Payments** and **Family settings**. The child's warm adventure view has separate **My adventure**, **My week** and **My money** navigation. Use **Lock & child view** before handing over a live parent device; this removes its parent session. Returning to the live parent area requires sign-in.

Direct demo links: [parent dashboard](https://little-helpers-family-quest.plainpapaya4.chatgpt.site/?demo=1&area=parent) and [child adventure](https://little-helpers-family-quest.plainpapaya4.chatgpt.site/?demo=1&area=child). The `area` choice is kept in the URL when switching views. Parent navigation changes management sections without returning to the child adventure.

## First family setup

1. In Supabase **Authentication → URL Configuration**, set the Site URL to the deployed app origin and allow that origin as a redirect URL. This lets account-confirmation emails return to the correct app. Add the Netlify origin too when you move hosting.
2. Open the live app and choose **I’m new — set up my family**. Enter your email, create and confirm a new Little Helpers password, then choose **Create parent account**. Follow the email-confirmation screen, confirm your email, then return to sign in. Returning parents choose **I already have an account**. Supabase's default confirmation-email service has a low sending limit; configure your own SMTP service if needed.
3. In **Family settings**, set your child's display name, essential-star target, money goals, time zone, and pocket-money day.
4. In **Tasks & rewards**, set age-appropriate tasks and amounts. Essentials earn stars, not money. Paid extras should reflect effort and helping beyond everyday routines.
5. In **Family settings → Pair a tablet**, create a link and open it on the child's tablet within ten minutes. Links work once. Paired devices last thirty days; you can revoke them at any time.
6. On a parent's device, review jobs and record the weekly payment. Use **Lock & child view** before handing a signed-in parent device to your child.

Each family has an **original parent (owner)** and can have **one additional parent**. Both use their own email/password and share the same child's tasks, reviews, savings target and pocket-money history. The original parent controls invitations and removing partner access. Both parents can edit tasks, review jobs, record payouts and create child-tablet links. Only the original parent can revoke all child devices.

To invite your partner, open **Parent dashboard → Family settings → Parents & access → Invite an additional parent**, enter their email and copy the invitation link. Share it yourself; the app does not send it automatically. Your partner opens it, signs in or creates an account using the invited email, confirms their email if necessary, then selects **Join the family**. Return to the original invitation tab after email confirmation. Invitations last seven days, work once and are bound to that email address. No account password is shared.

The owner can cancel unaccepted invitations or remove the additional parent. Removal keeps all family progress and money history, denies future parent requests, and also disconnects devices and unredeemed tablet links created by that parent. Existing families retain their original owner and records. Child pairing links are separate and never grant parent access.

Use invitations from your Netlify URL once deployed. The ChatGPT-hosted preview remains private to its owner, so its outer access gate may prevent a partner from opening a preview invitation.

## Deploy to Netlify from GitHub

1. Put this source in an empty GitHub repository, preserving the directory layout.
2. In Netlify, choose **Import an existing project → GitHub**, then select that repository.
3. Netlify reads `netlify.toml`: build command `npm run build`, publish directory `dist`, functions directory `netlify/functions`. No npm dependencies are required. Node 22 is selected.
4. To run the same-origin Netlify Functions backend, set these environment variables for **Functions** in Netlify:
   - `SUPABASE_URL`: your project's URL.
   - `SUPABASE_PUBLISHABLE_KEY`: a publishable API key from Supabase Settings → API Keys.
   - `SUPABASE_SECRET_KEY`: a secret API key from the same page. **Server only. Never put it in `dist/`, GitHub, chat, or a public-prefixed environment variable.**
5. Deploy, then update Supabase's Site URL to `https://pocket-money-helper.netlify.app` and add `https://pocket-money-helper.netlify.app/**` to the redirect allowlist. These return settings have been verified for the current live URL.
6. Test parent sign-in and tablet pairing on the Netlify URL. The app automatically prefers the same-origin Netlify backend when its variables are configured, so the existing Edge Function does not need a new origin allowlist.

If you want a different Supabase project, run `supabase/schema.sql` and then `supabase/parent-access.sql` once in that project's SQL editor and configure the three Netlify variables. Remove `dist/runtime.json` so it cannot fall back to the current hosted backend. Do not rerun the schema against the existing Little Helpers project: both setup migrations are already applied.

The app is now deployed on Netlify. Its current deployment uses the existing Supabase Edge backend through `dist/runtime.json`; the Edge function explicitly allows `https://pocket-money-helper.netlify.app`. This mode works without Netlify Function secrets. If the three Netlify variables above are configured, the app instead uses its same-origin Netlify Functions backend automatically. For a new domain, update Supabase's return URLs and either configure the same-origin backend or add that exact origin to the Edge allowlist.

### Confirmation and password reset

The sign-in screen includes **Forgot your password?**. Enter the parent account email to request a recovery link, then choose and confirm a new password after following the email. The app verifies the returned session with Supabase Auth before displaying the new-password form, removes session tokens from the URL, and saves the new password only through the authenticated Auth API. No family records or permissions change during recovery.

Confirmation emails also return a verified session to the app, so a successful confirmation opens the parent dashboard (or invitation acceptance). Expired or previously used links show an explanation and sign-in/reset options. Email links are single use; always use the newest email. A generic **Failed to fetch** during family loading can indicate a missing origin allowlist entry even when the password has been accepted.

### Toy links

Automatic product lookup reads Schema.org JSON-LD or Open Graph metadata from supported shops, including LEGO, Smyths, Argos, The Entertainer, John Lewis, Amazon and several other retailers listed in `shared/product-import.mjs`. It does not run shop scripts. Some shops block automated access or omit images/prices; the child can still enter a name, price and description, and optionally a picture link. Unsupported shops also use this manual flow. Missing or foreign-currency prices must be entered in pounds, rather than being guessed or converted.

The importer authenticates the family first, fetches only the supported retailer domains over HTTPS, validates redirects, caps the response size and request time, and never forwards family tokens to shops. Preview text is escaped and the site never executes imported HTML. Product pictures load from the shop/CDN with no referrer; unavailable pictures get a friendly fallback. The retailer list can be extended in code and redeployed.

Choosing a toy changes only the savings target. It does not change task rewards, approval requirements, or money earned. Parents can adjust the target in Family settings; changing the goal's name there clears the old product picture/details.

## Local development and checks

```sh
npm test
npm run build
```

Serve `dist/` with any static server and append `?demo=1` for the browser-local sample. For the real Netlify API locally, use Netlify Dev and set variables from `.env.example` in an ignored `.env` file. Never commit it.

The tests verify the threshold, parent-only actions, approval values, retries, duplicate daily/weekly claims, payout timing and idempotence, week/time-zone boundaries, historical records, API authorization, optimistic concurrency, product metadata extraction, retailer/redirect validation, child goal permissions and the sample-toy save flow, parent invitation/join permissions, shared-family access, removal and the invited-account onboarding flow.

## Architecture and access

`shared/domain.mjs` is the single source for reward rules. Both the demo and server use it; server dates come from the family's time zone. The client cannot submit a different completion date or reward amount. A submission snapshots its task name, picture, and value. Later task edits preserve the agreed reward; resubmitting a returned job uses the current reward.

Supabase stores one small JSON family aggregate with a revision counter, plus separate hashed pairing/device tokens, parent memberships and email-bound invitation hashes. Every change uses an atomic `UPDATE ... WHERE revision = old_revision`, retries after competing changes, and rechecks every rule. This keeps updates from multiple tablets from overwriting one another. All money is integer pennies.

All tables have Row Level Security. A parent can directly read only family records they own or have explicitly joined through an invitation. Anonymous users cannot read tables; authenticated clients cannot write them. Only the backend's service identity writes state. Device tokens are random, expire, and are stored as SHA-256 hashes in the database. The API verifies a parent JWT with Supabase Auth or checks the child-device token on every request. Child requests are restricted to reading family progress, submitting jobs, looking up a product and setting their savings target.

The Supabase security advisor flags disabled [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection); enable it in the project’s Auth password-security settings if available on your plan. Its three informational [RLS-without-policy notices](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) are intentional: devices, tablet pairing rows and parent invitation rows have no client grants or policies because only the backend should access them.

`supabase/edge/` contains the deployed adapter and a copy of the shared API/rules. Run `node scripts/prepare-edge.mjs` after changing server rules, then redeploy that function. The Edge adapter permits requests from the current hosted app origin. Netlify runs the API directly and does not use this adapter.

## Weekly rules

- Weeks always run Monday–Sunday in the family's selected time zone.
- The star threshold resets each Monday; old records and unpaid weeks remain available.
- Current-week payouts are allowed on the configured payout day. Previous unpaid weeks can be paid later.
- Clear all pending reviews for a week before paying it. Each week can be paid once.
- A payout closes paid extra jobs for that week. Essentials remain available.
- The weekly money goal motivates; it is not a cap. Changing a target does not remove approved earnings.
- Brushing teeth is represented as one daily task covering morning and bedtime. Use two tasks if you prefer separate checks.
- Savings progress is a record of allowance earned, not a bank balance. There is no withdrawal/spending tracker in this version.

## Verification limits

Automated rule/API tests passed. The deployed Edge Function was checked for unauthenticated access rejection, expired device/pairing rejection, and CORS. Database grants and RLS were queried directly. Full browser and tablet testing, and a real parent's email-confirmation/sign-in flow, still need to be completed; the managed browser test tool was unavailable in the build environment.
