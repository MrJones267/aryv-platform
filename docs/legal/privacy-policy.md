# ARYV Privacy Policy

**Last updated: 23 August 2026**

> **Status: draft requiring legal review before publication.**
> This was written from what the ARYV codebase actually collects, stores and
> transmits, so that the published policy describes real behaviour rather than
> a template's assumptions. It is not legal advice. A qualified adviser must
> review it against the jurisdictions ARYV operates in — Botswana's Data
> Protection Act, and the GDPR wherever users are in the EU/EEA — before it
> goes live. Where a decision is commercial or legal rather than technical, the
> text below is marked **[CONFIRM]**.

ARYV ("we", "us") operates the ARYV ride-sharing and courier platform. This
policy explains what we collect, why, who we share it with, and what you can
do about it.

Contact: **[CONFIRM: privacy contact address]** — currently `hello@aryv-app.com`.

---

## 1. Information we collect

### 1.1 Information you give us

| Data | When | Why |
|---|---|---|
| Name, email address, phone number | Account creation | Identify your account, contact you about a trip |
| Password | Account creation | Authentication. Stored only as a bcrypt hash; we never store or transmit it in readable form |
| Date of birth, profile photo, address | Optional profile fields | Personalisation, and to help other users recognise you |
| Emergency contact name and phone | Optional | Shown or contacted only in a safety incident |
| Identity and vehicle documents — driver's licence, passport, national ID, vehicle registration, insurance | Driver or courier verification | Legal requirement to confirm you may drive or carry goods, and to protect other users |
| Vehicle details | Driver onboarding | Match riders to vehicles, display to passengers |
| Trip and package details, including addresses | Booking a ride, sending a package | Deliver the service |
| Messages you send in the app | In-trip and group chat | Deliver the service, and to investigate disputes and safety reports |
| Ratings and reviews | After a trip | Maintain trust between users |

### 1.2 Information collected automatically

| Data | Source | Why |
|---|---|---|
| Precise location | Device GPS, while the app is in use | Find nearby rides, navigate, share live trip progress, and confirm pickup and drop-off |
| Device and app diagnostics, crash reports | Firebase Crashlytics | Diagnose faults |
| Usage analytics | Firebase Analytics | Understand which features are used |
| IP address, request metadata | Our servers | Security, rate limiting, abuse prevention |
| Push notification token | Firebase Cloud Messaging | Send trip and message notifications |

**Location.** ARYV requests precise location and uses it only while the app is
open and you are using a location feature. We do not collect location in the
background. **[CONFIRM]** — this must be revisited if background trip tracking
is added, which would require a separate disclosure and a distinct Android
permission.

**Camera and microphone.** The camera is used to take profile photos, capture
verification documents, and scan delivery codes. The microphone is used only if
you place an in-app call. Neither is accessed at any other time, and we do not
record audio or video except as part of a call you initiate.

### 1.3 What we do not collect

We do not collect your contacts, your browsing outside the app, biometric
identifiers, or data about your health, religion, politics or sexuality.

---

## 2. How we use your information

- To provide the service: matching, booking, navigation, delivery, payment.
- To keep users safe: verifying drivers and couriers, investigating reports,
  responding to disputes.
- To communicate with you about trips, deliveries and account activity.
- To detect and prevent fraud and abuse.
- To meet legal, tax and regulatory obligations.
- To improve the product, using aggregated and diagnostic data.

We do not sell your personal information, and we do not use it for advertising
by third parties.

**Automated decision-making.** Matching and pricing use algorithms. Decisions
that materially affect you — in particular approving or refusing a driver or
courier application — are made by a person, not automatically.

---

## 3. Who we share it with

**Other users, to the minimum needed for the trip.** A driver sees a
passenger's first name, rating, and pickup and drop-off points. A passenger
sees a driver's name, rating, photo and vehicle. Contact details are shared
only as far as the trip requires. Your identity documents are never shown to
another user.

**Service providers**, who process data only on our instructions:

| Provider | Purpose | Data |
|---|---|---|
| Railway | Application and database hosting | All service data |
| Google Firebase | Push notifications, crash reporting, analytics | Device identifiers, diagnostics |
| Google Maps Platform | Maps, geocoding, routing | Location and address data |
| Twilio | SMS verification codes | Phone number |
| Cloudflare | Content delivery, DNS, file storage | Request metadata, uploaded files |
| **[CONFIRM: payment processor]** | Payments and escrow | Transaction data |

**Authorities**, where we are legally required to disclose, or where disclosure
is necessary to prevent serious harm.

**In a business transfer**, if ARYV is acquired or merged, subject to this
policy continuing to apply.

---

## 4. Where your data is held

Our infrastructure providers operate outside Botswana, so your data is
transferred and stored internationally. **[CONFIRM: name the hosting regions,
and the lawful transfer mechanism relied on for EU/EEA users — standard
contractual clauses or an adequacy decision.]**

---

## 5. How long we keep it

| Data | Retention |
|---|---|
| Account and profile data | While your account is open |
| Trip, booking and delivery records | **[CONFIRM: 7 years]**, for tax, accounting and dispute purposes |
| Financial and commission records | **[CONFIRM: statutory retention period]** |
| Verification documents | While you are an active driver or courier, then **[CONFIRM]** |
| Chat messages | **[CONFIRM]** |
| Crash and diagnostic data | As retained by Firebase, currently up to 90 days |
| Deleted accounts | Personal data erased on request; see section 6 |

---

## 6. Your rights and your choices

You can, at any time:

- **Access** the personal data we hold about you.
- **Correct** anything inaccurate, from the app's profile screens.
- **Delete your account and personal data** — in the app under
  Settings → Privacy → Delete My Account, or by writing to us at the address
  above. See section 6.1.
- **Object to, or restrict, processing** in certain circumstances.
- **Withdraw consent** for optional processing, such as analytics.
- **Port your data** to another provider in a machine-readable form.
- **Complain** to your data protection authority.

Where the GDPR applies, our legal bases are: performance of a contract (to
provide the service), legal obligation (driver verification, tax records),
legitimate interests (safety, fraud prevention, service improvement), and
consent (optional analytics).

### 6.1 What deleting your account does

Deleting your account erases your personal data: your email address, phone
number, name, profile photo, date of birth, address, emergency contacts,
preferences and location settings are removed from our systems.

Completed trips, deliveries and financial records are **retained in anonymised
form**. They are no longer linked to anything identifying you, but they cannot
be removed entirely because they are also the other party's record of a
transaction and are required for tax and dispute purposes. Deletion is
permanent and cannot be reversed.

---

## 7. Security

Passwords are hashed with bcrypt and never stored in readable form. Traffic
between the app and our servers is encrypted in transit with TLS. Access tokens
are invalidated on logout. Verification documents are not publicly accessible:
they are served only to the person who submitted them and to authorised
reviewers, over an authenticated connection. Access to production systems is
restricted to authorised staff.

No system is perfectly secure. If a breach affects your personal data, we will
notify you and the relevant authority as required by law.

---

## 8. Children

ARYV is not for anyone under 18. We do not knowingly collect data from
children. If you believe a child has given us personal data, contact us and we
will delete it.

---

## 9. Changes

We will post any change to this policy here and update the date at the top. For
significant changes we will notify you in the app or by email before they take
effect.

---

## 10. Contact

Questions, requests, or complaints about this policy:

**Email:** hello@aryv-app.com
**Postal address:** **[CONFIRM]**
**Data protection officer:** **[CONFIRM: whether one is required]**
