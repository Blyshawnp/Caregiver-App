# Personal Caregiver App Release Readiness Checklist

Last updated: June 4, 2026

Use this checklist before any private/personal production release. This is a verification checklist, not a guarantee of legal, tax, medical, payroll, or emergency readiness. Items should be checked in the deployed production environment with real production configuration and non-sensitive test records.

## 1. Git and Deployment

- [ ] Current branch is `main`.
- [ ] `git status` is clean before deployment.
- [ ] `npm run build` passes locally.
- [ ] Production Vercel deployment completes successfully.
- [ ] Latest commit is deployed to the intended Vercel project.
- [ ] Production environment variables are verified in Vercel.
- [ ] Production URLs are set correctly.
- [ ] Supabase Auth site URL and redirect URLs match production.
- [ ] No `.env` files are committed.
- [ ] `supabase/.temp` is not committed.
- [ ] Supabase service role key is used only server-side.
- [ ] Browser bundles do not expose server-only secrets.
- [ ] Deployment rollback plan is documented.

## 2. Supabase Database

- [ ] All migrations are applied with `supabase db push`.
- [ ] No `supabase db reset` is used against production.
- [ ] RLS is enabled on user, client, shift, task, document, invoice, and notification tables.
- [ ] RLS policies are verified for admin, caregiver, client, and family roles.
- [ ] Organization scoping prevents cross-household or cross-organization access.
- [ ] Storage metadata tables match the application queries.
- [ ] `profiles.organization_id` is present for every active user.
- [ ] Setup/onboarding completion fields are present and populated.
- [ ] Notification preferences and tutorial fields are present.
- [ ] Invoice, year-end, audit, correction, and dispute tables preserve history.
- [ ] Seed or test data is removed or clearly marked as test data.
- [ ] Backup/export process is documented.

## 3. Supabase Storage

Verify each bucket exists with the expected public/private setting:

- [ ] `avatars` exists and is private.
- [ ] `pet-photos` exists and is private.
- [ ] `client-photos` exists and is private.
- [ ] `client-files` exists and is private.
- [ ] `documents` exists and is private.
- [ ] `app-assets` exists and contains only non-sensitive public app assets.

For each bucket:

- [ ] Upload works for allowed users.
- [ ] View/display works for allowed users.
- [ ] Delete works only where allowed.
- [ ] Signed URLs work for private files.
- [ ] Unauthorized users cannot fetch private files.
- [ ] Sensitive files are not stored in `app-assets`.
- [ ] Old public URL values still resolve through the signed URL path when possible.

## 4. Authentication and Onboarding

- [ ] Login works.
- [ ] Logout works.
- [ ] Forgot password works.
- [ ] Reset password works.
- [ ] Email change works.
- [ ] Password change works.
- [ ] Invite flow works for caregivers and family/client users.
- [ ] First-time setup or profile completion does not loop.
- [ ] Tutorial shows after first login/setup completion.
- [ ] Tutorial can be skipped.
- [ ] Tutorial can be restarted from Help.
- [ ] Tutorial does not block emergency access.
- [ ] Onboarding checklist can be dismissed.
- [ ] Missing intro video is skipped without runtime errors.

## 5. Roles and Permissions

- [ ] Admin can manage allowed household/care-circle records.
- [ ] Caregiver can view assigned shifts and allowed client information.
- [ ] Client can view/manage only allowed client-side records.
- [ ] Family can view only allowed family records.
- [ ] Organization admin behavior is verified where applicable.
- [ ] Personal/family mode is verified.
- [ ] Client-directed care mode is verified if enabled.
- [ ] Solo caregiver mode is verified if enabled.
- [ ] No role can access unrelated data by URL guessing.
- [ ] Read-only users do not see edit/delete actions.
- [ ] Server APIs enforce role checks, not just UI hiding.

## 6. Clients and Care Recipients

- [ ] Create client/care recipient.
- [ ] View client/care recipient without entering edit mode.
- [ ] Edit client/care recipient with allowed role.
- [ ] Profile photo upload works.
- [ ] Profile photo displays through signed URL or fallback.
- [ ] Emergency info is visible to allowed users.
- [ ] Home info is visible to allowed users.
- [ ] Pets are visible from the client profile.
- [ ] Documents are visible from the client profile.
- [ ] Emergency guide is visible where implemented.
- [ ] Geofence/address validation works.
- [ ] Structured and fallback addresses display correctly.
- [ ] Sensitive home access details are not exposed to unrelated users.

## 7. Pets

- [ ] Add pet.
- [ ] Edit pet.
- [ ] Remove pet where allowed.
- [ ] Upload pet photo.
- [ ] Choose pet preset avatar if allowed.
- [ ] Pet photo/preset displays without broken image icons.
- [ ] Pet photo preview opens where implemented.
- [ ] Pet appears from client profile.
- [ ] Pet summary appears before accepting a shift where applicable.
- [ ] Pet wording is neutral.
- [ ] Duplicate pet sections are not shown on shift screens.
- [ ] Allergy/safety reminder is visible without exposing private notes to unauthorized users.

## 8. Documents and Print Approval

- [ ] Upload documents from allowed screens.
- [ ] View documents from client profile.
- [ ] View relevant documents from shift detail.
- [ ] Document count matches document list.
- [ ] Documents are not hidden only inside edit mode.
- [ ] Private document access uses signed/authenticated URLs.
- [ ] Request print approval works.
- [ ] Admin/client can approve print request.
- [ ] Admin/client can deny print request with reason.
- [ ] Approved users can print approved documents.
- [ ] Unapproved users cannot print restricted documents.
- [ ] Mobile print flow is usable.
- [ ] Print view is clean and supports Save as PDF.

## 9. Scheduling and Shifts

- [ ] Create shift.
- [ ] Edit shift.
- [ ] Delete/cancel shift with correct permissions.
- [ ] Force assign works for admins.
- [ ] Force accept works only where allowed.
- [ ] Caregiver can accept shift.
- [ ] Caregiver can decline or request removal.
- [ ] 48-hour warning appears where required.
- [ ] Trade/coverage request works if enabled.
- [ ] Bulk select shifts works.
- [ ] Add tasks to selected shifts works.
- [ ] Export one shift to calendar.
- [ ] Export selected shifts to calendar.
- [ ] Export all my shifts to calendar.
- [ ] Shift tracking number appears only at bottom of shift detail.
- [ ] Shift tracking number auto-fills disputes/reports/corrections.
- [ ] Duplicate shift summary boxes are removed.

## 10. Tasks

- [ ] Required tasks display and can be completed.
- [ ] Optional tasks display and can be completed.
- [ ] PRN/if-needed tasks display and can be marked.
- [ ] PRN unchecked does not warn as missed.
- [ ] Needs follow-up PRN status notifies the right users.
- [ ] Time-of-day metadata is preserved when tasks are copied to shifts.
- [ ] Exact scheduled time is preserved.
- [ ] Task sort order is preserved.
- [ ] Default tasks apply only on selected days.
- [ ] Task categories display without raw enum labels.
- [ ] Bulk add tasks avoids duplicates where expected.
- [ ] Existing future/incomplete task timing repair is verified.

## 11. Check-In and Check-Out

- [ ] Check in works.
- [ ] Check out works.
- [ ] Incomplete required tasks show checkout warning/blocking behavior.
- [ ] Optional tasks do not block checkout.
- [ ] PRN behavior matches settings.
- [ ] Break/lunch works if enabled.
- [ ] Geofence check works if enabled.
- [ ] Outside-geofence reason is captured.
- [ ] Time correction request works.
- [ ] Admin correction reason is required.
- [ ] Audit trail records actor, timestamp, and reason.
- [ ] Auto checkout behavior is verified.

## 12. Emergency

- [ ] Top emergency button is visible.
- [ ] Emergency information card is present only once where useful.
- [ ] Emergency guide is linked from the emergency card if available.
- [ ] Duplicate emergency sections are removed.
- [ ] Emergency icon is the correct red emergency icon.
- [ ] Emergency disclaimer is reachable.
- [ ] Terms state the app is not a substitute for 911/emergency services.
- [ ] Emergency access is not blocked by tutorial/onboarding UI.

## 13. Notifications

- [ ] In-app notifications appear.
- [ ] Push enable flow waits for an active service worker.
- [ ] Browser permission is re-checked after Allow.
- [ ] Test push arrives on supported devices.
- [ ] Test push diagnostics explain failures.
- [ ] Android Chrome push test passes.
- [ ] Android installed PWA push test passes.
- [ ] iPhone installed Home Screen PWA push test passes.
- [ ] iPhone browser tab limitation is documented.
- [ ] Notification categories are configurable.
- [ ] In-app sound/tone settings work after user interaction.
- [ ] Quiet hours work if configured.
- [ ] Urgent override behavior is verified.
- [ ] Notification privacy-safe body setting is respected.
- [ ] Push payloads contain no sensitive details when privacy-safe mode is enabled.
- [ ] App does not claim "sent" without diagnostics when delivery cannot be confirmed.

## 14. PWA and Install

- [ ] `manifest.json` is valid.
- [ ] Icons load.
- [ ] Maskable icon is valid.
- [ ] iPhone home screen icon appears correctly.
- [ ] Android icon appears correctly.
- [ ] Install prompt suppression works after "Do not show again".
- [ ] Install prompt suppression works after "Do not show for 24 hours".
- [ ] Manual install button is available from Settings.
- [ ] Installed standalone mode is detected.
- [ ] Basic offline shell behavior works.
- [ ] Service worker update does not break push subscription.

## 15. Profile Photos and Avatars

- [ ] User avatar upload works.
- [ ] Admin can upload caregiver avatar.
- [ ] Client/care recipient photo upload works.
- [ ] Pet photo upload works.
- [ ] Avatar preset picker opens from change photo flow.
- [ ] Preset avatars load from `public/avatar-presets`.
- [ ] Vecteezy attribution is present.
- [ ] Image preview modal works where implemented.
- [ ] Uploaded private avatars use signed URLs.
- [ ] Missing images show fallback initials or preset fallback.
- [ ] No broken image icons are visible.

## 16. Invoices, Payroll, and Year-End

- [ ] Invoice generation works.
- [ ] Payment recording works.
- [ ] Balance updates after payment.
- [ ] Invoice adjustment line can be added.
- [ ] Invoice dispute/correction workflow works.
- [ ] Caregiver pay summary is accurate.
- [ ] Year-end summary generation works.
- [ ] Year-end summary can be voided/deleted by admin with `CONFIRM`.
- [ ] Original totals are preserved when corrections are made.
- [ ] Audit trail captures actor, reason, timestamp, and original values.
- [ ] Private app contractor wording is present.
- [ ] App does not claim to provide payroll, tax, legal, or accounting advice.
- [ ] No W-2/1099 preparation claims are made.

## 17. Personal Use Readiness

- [ ] Household/care-circle ownership is clear.
- [ ] Personal/family care coordination language is clear.
- [ ] Data sharing expectations are documented.
- [ ] Caregiver independent contractor wording is reviewed.
- [ ] Emergency-services limitation is reviewed.
- [ ] Manual recordkeeping limitations are reviewed.
- [ ] Support/contact process is documented for household users.
- [ ] Backup/export plan is documented.

## 18. Legal, Privacy, and Help

- [ ] Terms are reachable.
- [ ] Privacy policy is reachable.
- [ ] Emergency disclaimer is reachable.
- [ ] Billing/pay disclaimer is reachable.
- [ ] Data deletion process is documented.
- [ ] Photo/document privacy is documented.
- [ ] Push notification disclaimer is documented.
- [ ] Intro video and tutorial stored settings are disclosed.
- [ ] Attorney review is completed before relying on legal text.

## 19. Spanish and I18n

- [ ] Navigation labels are translated.
- [ ] Dashboard labels are translated.
- [ ] Schedule labels are translated.
- [ ] Shift detail labels are translated.
- [ ] Task labels and PRN statuses are translated.
- [ ] Client labels are translated.
- [ ] Pet labels are translated.
- [ ] Document labels are translated.
- [ ] Emergency labels are translated.
- [ ] Invoice/settings/help/legal titles are translated where supported.
- [ ] No raw enum labels or underscores are visible.
- [ ] User-entered data is not translated.

## 20. Accessibility and Mobile

- [ ] Text contrast is readable.
- [ ] Tap targets are large enough.
- [ ] Buttons have accessible names.
- [ ] Images have alt text or decorative handling.
- [ ] Keyboard navigation basics work.
- [ ] Modal close actions are reachable.
- [ ] Mobile layout works on small phones.
- [ ] Tablet layout is acceptable.
- [ ] Bottom nav does not cover content.
- [ ] Print views are usable on mobile.

## 21. Performance and Logging

- [ ] No huge client payloads are sent unnecessarily.
- [ ] Images are optimized or constrained.
- [ ] Signed URL generation does not cause excessive reloads.
- [ ] Errors are logged safely.
- [ ] No secrets appear in console logs.
- [ ] No sensitive info appears in push payloads.
- [ ] Vercel logs are reviewed after smoke testing.
- [ ] Supabase logs are reviewed after smoke testing.

## 22. Browser and Device Test Matrix

- [ ] Android Chrome.
- [ ] Android installed PWA.
- [ ] iPhone Safari.
- [ ] iPhone Home Screen PWA.
- [ ] Desktop Chrome.
- [ ] Desktop Edge.
- [ ] Small phone screen.
- [ ] Tablet if possible.
- [ ] Slow network/basic offline behavior.

## 23. Native Packaging Readiness

This private/personal app is currently treated as a PWA unless a native wrapper is added later.

- [ ] Android package name is selected if native packaging is planned.
- [ ] Signing key strategy is documented.
- [ ] `versionCode` and `versionName` strategy is documented.
- [ ] Adaptive icon is verified.
- [ ] App icon border/cropping is fixed.
- [ ] Native notification channel strategy is documented.
- [ ] In-app update strategy is documented.
- [ ] Apple bundle ID is reserved if future iOS packaging is planned.
- [ ] iOS icon set is verified.
- [ ] TestFlight plan is documented if future iOS packaging is planned.

## 24. Final Launch Checklist

- [ ] Production env vars verified.
- [ ] Domain verified.
- [ ] Supabase Auth URLs verified.
- [ ] Redirect URLs verified.
- [ ] SMTP/email sending verified.
- [ ] VAPID public/private/subject verified.
- [ ] Storage buckets verified.
- [ ] RLS verified.
- [ ] App icons verified.
- [ ] Screenshots captured.
- [ ] Privacy policy URL verified.
- [ ] Support email/contact path verified.
- [ ] Account deletion path verified.
- [ ] Monitoring plan documented.
- [ ] Backup/export plan documented.
- [ ] Final smoke test completed.
- [ ] Release owner signs off.
