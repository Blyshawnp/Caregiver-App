# Improvement Plan for Caregiver-App

## 1. Centralize Notifications
Update `src/app/api/notifications/route.ts` to handle all notification types, including:
- `incident_reported`
- `incident_urgent`

## 2. Standardize Incident Reporting
Update `src/app/api/incidents/route.ts` to use the `sendNotificationEvent` or the central API.

## 3. Home Page Alerts
Add a component to display active urgent incidents on the home page for admins and family members.

## 4. Push Notification Hardening
Ensure `web-push.ts` handles empty payloads and missing keys gracefully.
