# Play Console — Data safety declaration

**Prepared 23 August 2026, from the code rather than from intent.**

Every row below was verified against what the app actually does: the manifest
permissions, the SDKs bundled in the build, and the fields the API stores. Play
suspends listings for declarations that do not match observed behaviour, and
Google does inspect traffic, so guessing here is expensive.

Answer **Yes** to "Does your app collect or share any of the required user data
types?"

---

## Data types to declare

Legend — **Collected**: leaves the device. **Shared**: passed to a third party.
"Processing" means it is used to deliver the feature the user asked for.

| Data type | Collected | Shared | Optional? | Purpose | Notes |
|---|---|---|---|---|---|
| Name | Yes | Yes | Required | App functionality | Shown to the other party on a trip |
| Email address | Yes | No | Required | App functionality, account management | |
| Phone number | Yes | Yes | Required | App functionality | SMS verification via Twilio; shared with the other party where a trip requires it |
| Address | Yes | No | Optional | App functionality | Optional profile field |
| Photos | Yes | No | Optional | App functionality | Profile photo, verification documents, package photos |
| Approximate location | Yes | Yes | Required | App functionality | Google Maps Platform |
| Precise location | Yes | Yes | Required | App functionality | Foreground only. Google Maps Platform |
| Microphone / voice | Yes | No | Optional | App functionality | Only during an in-app call the user initiates |
| In-app messages | Yes | No | Optional | App functionality | Retained for dispute and safety investigation |
| User payment info | Yes | Yes | Required | App functionality | **[CONFIRM once a payment provider is wired up]** |
| Purchase history | Yes | No | Required | App functionality | Trip and delivery records |
| Government ID | Yes | No | Optional | App functionality, fraud prevention | Drivers and couriers only. Never shown to other users |
| Crash logs | Yes | Yes | Required | Analytics | Firebase Crashlytics |
| Diagnostics | Yes | Yes | Required | Analytics | Firebase Crashlytics |
| App interactions | Yes | Yes | Required | Analytics | Firebase Analytics |
| Device or other IDs | Yes | Yes | Required | App functionality | FCM push token |

### Do not declare

Contacts, calendar, SMS content, call logs, browsing history, installed apps,
health, fitness, sexual orientation, race, political or religious beliefs.
None of these are collected — do not tick them "just in case", since an
over-declaration is as wrong as an under-declaration.

---

## Security practices section

| Question | Answer | Basis |
|---|---|---|
| Is data encrypted in transit? | **Yes** | TLS to `api.aryv-app.com`; the network security config permits cleartext only to localhost and development hosts |
| Can users request data deletion? | **Yes** | In-app under Settings → Privacy, plus a web request page |
| Has the app been independently reviewed against a security standard? | **No** | No such review has been done |
| Do you commit to the Play Families policy? | **No** | 18+ service |

**Before submitting:** remove the development hosts from
`network_security_config.xml`. Shipping a cleartext exemption for
`192.168.1.1`, `10.0.2.2` and a hard-coded LAN address is not a policy
violation on its own, but it weakens the claim above and there is no reason for
those entries to be in a release build.

---

## Sensitive permission declarations

Play requires a written justification for some permissions in the Console.

**`ACCESS_FINE_LOCATION`** — core to the product: matching riders with nearby
drivers, navigating to pickup and drop-off, sharing live trip progress with a
passenger's chosen contacts, and confirming a delivery happened where it was
supposed to. Collected only while the app is in use.

**`CAMERA`** — profile photos, capturing driver and courier verification
documents, photographing a package's condition at handover, and scanning
delivery confirmation codes.

**`RECORD_AUDIO`** — in-app voice calls between a rider and driver, so neither
has to disclose a personal phone number. Only active during a call the user
starts.

**`POST_NOTIFICATIONS`** — trip status, driver arrival, messages, and delivery
updates.

**`WRITE_EXTERNAL_STORAGE`** — capped at `maxSdkVersion="28"`; legacy support
for saving receipts on older devices.

---

## Open items before this can be submitted

1. **Payment data.** The escrow provider is not yet wired up. The payment rows
   above must be revisited once it is, and must match what that processor
   actually receives.
2. **Retention periods.** The privacy policy carries `[CONFIRM]` markers on
   retention windows. Data safety and the policy must agree.
3. **Analytics consent.** Firebase Analytics and Crashlytics are force-enabled
   in the manifest. For users in the EU/EEA that needs a consent gate, not a
   default-on flag.
4. **WebRTC.** Call screens are compiled into the binary regardless of the
   `ENABLE_WEBRTC_CALLS` flag, which lives in a `.env` Metro never reads. Either
   gate the feature at build time or declare microphone use as live.
