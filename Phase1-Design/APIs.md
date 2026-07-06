# Waitless API Specification (MVP)


## Resource Hierarchy

```
Authentication
│
├── Organizations
│   ├── Branches
│   ├── Members
│   ├── Doctor Schedules
│   │     └── Schedule Exceptions
│   ├── Sessions
│   │     └── Appointments
│   └── Subscription
│
├── Marketplace
│
├── Patients
│
├── Queue
│
└── Admin
```


## Conventions

### Authentication

Protected endpoints require:

```
Authorization: Bearer <access_token>
```

### Success Codes

| Code | Meaning    |
| ---- | ---------- |
| 200  | Success    |
| 201  | Created    |
| 204  | No Content |

### Error Codes

| Code | Meaning          |
| ---- | ---------------- |
| 400  | Bad Request      |
| 401  | Unauthorized     |
| 403  | Forbidden        |
| 404  | Not Found        |
| 409  | Conflict         |
| 410  | Gone             |
| 422  | Validation Error |

---

# 1. Authentication

## Register Patient

```
POST /auth/user/register
```

Creates a patient account and sends an email verification code.

---

## Register Staff

```
POST /auth/worker/register
```

Creates a staff account (used only for organization founders).

---

## Login Patient

```
POST /auth/user/login
```

Returns

```
{
  account,
  accessToken,
  refreshToken
}
```

---

## Login Staff

```
POST /auth/worker/login
```

---

## Refresh Access Token

```
POST /auth/refresh
```

---

## Logout

```
POST /auth/logout
```

---

## Current User

```
GET /auth/me
```

Authentication required.

---

## Request Email Verification

```
POST /auth/email/verify/request
```

---

## Confirm Email Verification

```
POST /auth/email/verify/confirm
```

---

## Request Phone Verification

```
POST /auth/phone/verify/request
```

---

## Confirm Phone Verification

```
POST /auth/phone/verify/confirm
```

---

## Request Password Reset

```
POST /auth/password-reset/request
```

Always returns success.

---

## Confirm Password Reset

```
POST /auth/password-reset/confirm
```

---

# 2. Organizations

## Create Organization

```
POST /organizations
```

Creates a new clinic/hospital.

Also creates

* Admin membership
* Trial subscription

Authentication required.

---

## View Public Organization

```
GET /organizations/:slug
```

Public endpoint.

Returns marketplace-safe information only.

Only organizations satisfying

```
isPublic = true
status = active
```

can be retrieved.

---

## View Organization (Dashboard)

```
GET /organizations/:id
```

Organization admin only.

Returns complete organization data.

---

## Update Organization

```
PATCH /organizations/:id
```

Requires permission:

```
organization.update
```


---

## Delete Organization

```
DELETE /organizations/:id
```

Soft delete.

Owner / Platform Admin only.

---

## Publish Organization

```
PATCH /organizations/:id/public
```

Enable/disable marketplace listing.

Requires

* Organization Owner
* Active subscription
* Marketplace enabled plan

---

# 3. Branches

## List Branches

```
GET /organizations/:id/branches
```

Public organizations return limited information.

Private organizations require membership.

---

## Get Branch

```
GET /branches/:branchId
```

---

## Create Branch

```
POST /organizations/:id/branches
```

---

## Update Branch

```
PATCH /branches/:branchId
```

---

## Delete Branch

```
DELETE /branches/:branchId
```

---

# 4. Staff Invitations

## Invite Staff

```
POST /organizations/:id/members
```

Creates a pending Membership.

Supports

* admin
* doctor
* receptionist

---

## Lookup Invitation

```
GET /members/invites/:token
```

Public endpoint.

---

## Accept Invite (New Account)

```
POST /members/invites/accept/new
```

---

## Accept Invite (Existing Account)

```
POST /members/invites/accept/existing
```

Authentication required.

---

## List Members

```
GET /organizations/:id/members
```

Supports filters

```
kind
status
branch
```

---

## Get Member

```
GET /members/:membershipId
```

---

## Update Member

```
PATCH /members/:membershipId
```

Role-specific fields only.

Cannot change role.

---

## Suspend Member

```
PATCH /members/:membershipId/suspend
```

---

## Reactivate Member

```
PATCH /members/:membershipId/reactivate
```

---

## Revoke Member

```
DELETE /members/:membershipId
```

---

# 5. Doctor Schedules

## Create Schedule

```
POST /doctor-schedules
```

---

## List Organization Schedules

```
GET /organizations/:id/doctor-schedules
```

---

## Get Schedule

```
GET /doctor-schedules/:scheduleId
```

---

## Update Schedule

```
PATCH /doctor-schedules/:scheduleId
```

---

## Disable Schedule

```
PATCH /doctor-schedules/:scheduleId/deactivate
```

---

## Delete Schedule

```
DELETE /doctor-schedules/:scheduleId
```

(Optional if soft delete isn't used.)

---

# 6. Schedule Exceptions

## Create Exception

```
POST /doctor-schedules/:scheduleId/exceptions
```

---

## List Exceptions

```
GET /doctor-schedules/:scheduleId/exceptions
```

---

## Delete Exception

```
DELETE /schedule-exceptions/:exceptionId
```

---

# 7. Sessions

## List Sessions

```
GET /sessions
```

Supports

* doctor
* branch
* organization
* date
* status

---

## Get Session

```
GET /sessions/:sessionId
```

---

## Start Session

```
PATCH /sessions/:sessionId/start
```

---

## End Session

```
PATCH /sessions/:sessionId/end
```

---

## Cancel Session

```
PATCH /sessions/:sessionId/cancel
```

---

# 8. Appointments

## Marketplace Booking

```
POST /sessions/:sessionId/appointments
```

Patient only.

---

## Walk-in Booking

```
POST /sessions/:sessionId/walk-in
```

Receptionist/Admin only.

---

## List Session Appointments

```
GET /sessions/:sessionId/appointments
```

---

## Get Appointment

```
GET /appointments/:appointmentId
```

---

## Cancel Appointment

```
PATCH /appointments/:appointmentId/cancel
```

Patient or staff.

---

## Call Next Patient

```
POST /sessions/:sessionId/call-next
```

---

## Skip Patient

```
PATCH /appointments/:appointmentId/skip
```

---

## Check In Patient

```
PATCH /appointments/:appointmentId/check-in
```

---

## Complete Appointment

```
PATCH /appointments/:appointmentId/complete
```

---

# 9. Live Queue

## Queue Page

```
GET /queue/:accessToken
```

Public.

Returns

* current position
* estimated wait
* queue status
* doctor
* branch

---

## Queue WebSocket

```
WS /queue/:sessionId
```

Real-time updates.

---

# 10. Marketplace

## Search Organizations

```
GET /marketplace/organizations
```

Supports

* search
* specialty
* city
* page
* limit

---

## Organization Doctors

```
GET /marketplace/organizations/:slug/doctors
```

---

## Doctor Details

```
GET /marketplace/doctors/:membershipId
```

---

## Doctor Availability

```
GET /marketplace/doctors/:membershipId/sessions
```

Returns upcoming bookable sessions.

---

# 11. Patient Profiles

## My Profile

```
GET /patients/me
```

---

## Update My Profile

```
PATCH /patients/me
```

---

## Get Patient

```
GET /patients/:patientId
```

Staff only.

---

# 12. Billing

## Current Subscription

```
GET /billing/subscription
```

---

## Available Plans

```
GET /billing/plans
```

Public.

---

## Upgrade Subscription

```
POST /billing/subscription
```

Creates a Paymob checkout session.

---

## Cancel Subscription

```
PATCH /billing/subscription/cancel
```

---

## Payment Webhook

```
POST /billing/webhook
```

Paymob only.

---

# 13. Reviews (Post-MVP)

## Create Review

```
POST /appointments/:appointmentId/review
```

---

## List Reviews

```
GET /doctors/:membershipId/reviews
```

---

# 14. Administration

## Audit Logs

```
GET /admin/audit-logs
```

Platform admin.

---

## Platform Accounts

```
GET /admin/accounts
```
