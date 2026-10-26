# Building ARYV for Android

## Build from Windows, not from WSL

The Android build must be run from Windows (PowerShell or Command Prompt), not
from a WSL shell.

This is not a preference. The Android SDK is installed under
`C:\Users\<you>\AppData\Local\Android\Sdk`, and every NDK in it ships only
Windows host toolchains:

```
Sdk\ndk\27.1.12297006\prebuilt\
    windows-x86_64          <- the only host toolchain present
```

A gradle build running under Linux looks for `prebuilt/linux-x86_64`, does not
find it, and fails while configuring the first module with native code:

```
A problem occurred configuring project ':react-native-reanimated'.
> Could not determine NDK host architecture. None of the following directories
  exist: .../ndk/23.1.7779620/prebuilt/linux-x86_64
```

Confirmed on 23 August 2026: a `bundleRelease` from WSL spent 46 minutes in
configuration before failing on exactly this. It also emitted
`[CXX1416] Could not find Ninja on PATH`, which is the same root cause — the
CMake and Ninja binaries in the SDK are Windows executables.

There is a second, independent reason to avoid WSL here. `node_modules`, the
SDK, and the project all sit on `/mnt/c`, which WSL reaches over a 9p filesystem
mount. The failed build above used 21 seconds of CPU across 14 minutes of wall
clock: it was almost entirely waiting on I/O. Even if the NDK problem were
solved, builds would be impractically slow.

The `hs_err_pid*.log` and `replay_pid*.log` files in this directory are JVM
crash dumps from earlier attempts and can be deleted.

### If you want to build from Linux anyway

Install a Linux Android SDK and NDK inside the WSL filesystem — not on
`/mnt/c` — and point `ANDROID_HOME` and `local.properties` at it. Clone the
repo into the WSL filesystem too (`~/`, not `/mnt/c`). Anything less and you
will hit one of the two problems above.

---

## Prerequisites

- **JDK 17** — `java -version` should report 17.x.
- **Android SDK** with platform 35 and build-tools 35.0.0 (Play requires
  `targetSdk` 35; see the note below).
- **NDK** matching `ndkVersion` in `android/build.gradle`.
- **Node 18+**, and `npm ci` run in `mobile-app/`.

`android/local.properties` is machine-specific and is no longer committed.
Create it if it does not exist:

```properties
sdk.dir=C\:\\Users\\<you>\\AppData\\Local\\Android\\Sdk
```

Android Studio writes this file automatically when you open the project.

---

## Signing

Release builds require `android/app/keystore.properties`:

```properties
storeFile=aryv-production.keystore
storePassword=<password>
keyAlias=aryv-release-key
keyPassword=<password>
```

Neither that file nor the keystore is committed. If `keystore.properties` is
missing, a release build now **fails with a clear error** rather than silently
signing with the debug key, which is what it used to do.

**Back the keystore up offline.** Losing it means losing the ability to ship an
update to the listing, permanently.

---

## Commands

Run from `mobile-app/`:

```powershell
# Debug APK, installed on a connected device or emulator
npm run android

# Release APK — for sideloading and manual testing
cd android; .\gradlew assembleRelease

# Release App Bundle — this is what Play accepts
cd android; .\gradlew bundleRelease
```

Output:

- APK — `android/app/build/outputs/apk/release/app-release.apk`
- AAB — `android/app/build/outputs/bundle/release/app-release.aab`

Regenerate launcher icons and store graphics after changing the SVG masters:

```
npm run icons:generate
```

---

## Before uploading to Play

1. **`targetSdk` is 34 and must be 35.** Play rejects the upload otherwise.
   Raising it also requires 16 KB memory page support, which React Native
   0.72.7 with NDK 23 does not provide — so this is a React Native upgrade, not
   a gradle edit. It is the largest outstanding piece of work.
2. **Increment `versionCode`** in `android/app/build.gradle` for every upload.
   It is still 1.
3. **Test the bundle, not the APK.** Install the AAB with `bundletool` on a
   real device. R8 runs with `fullMode` enabled against a hand-written
   ProGuard file, and release-only crashes hide exactly there.
4. **Remove the development hosts** from
   `android/app/src/main/res/xml/network_security_config.xml`. There is no
   reason for `10.0.2.2` or a hard-coded LAN address to hold a cleartext
   exemption in a release build.
5. **Verify 16 KB alignment** once the RN upgrade lands, by checking the
   `LOAD` segment alignment of the bundled `.so` files.
