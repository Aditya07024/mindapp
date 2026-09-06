# 🤖 Local Android APK Compilation Guide (No Android Studio, No Expo Cloud)

Since your system is already configured with Java 21 and the correct Android SDK build tools, you can build your Android APK completely locally using pure command line tools.

---

## 🛠️ Step 1: Prebuild the Native Directories
To generate the local, standard native `android/` directory (which contains all native Java/Kotlin and build configurations), run:
```bash
npx expo prebuild --platform android
```
> **Note**: This has already been run and successfully generated your local `android/` native folder based on your updated configurations in `app.json`!

---

## 📦 Step 2: Build a Debug APK (Instant Testing)
A Debug build is perfect for testing on your actual phone. Gradle automatically signs Debug builds with a default key, meaning you can copy and install it on any Android device immediately without configuring custom keystore credentials.

1. Navigate to the mobile directory (if not already there).
2. Run the Gradle wrapper build command:
   ```bash
   cd android && ./gradlew assembleDebug
   ```

### 📍 Output Location:
Once the compilation succeeds, your fully functional APK will be located at:
`mobile/android/app/build/outputs/apk/debug/app-debug.apk`

*Simply transfer this `app-debug.apk` file to your phone (via USB, email, Google Drive, or Slack) and open it to install!*

---

## 🔐 Step 3: Build a Signed Release APK (For Production)
If you want to build a Release APK to share with other users or upload to the Google Play Store, you need to sign the app with your own unique release key:

### 1. Generate a Keystore File:
Run this command from your terminal to generate a secure `.keystore` certificate:
```bash
keytool -genkey -v -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```
*Keep this keystore safe! You will need it to sign all future updates to your app.*

### 2. Configure gradle:
Place the generated `my-release-key.keystore` file inside the `mobile/android/app/` folder.

Then, update the `signingConfigs` block inside `mobile/android/app/build.gradle` to reference your keystore credentials:
```groovy
signingConfigs {
    release {
        storeFile file('my-release-key.keystore')
        storePassword 'your-store-password'
        keyAlias 'my-key-alias'
        keyPassword 'your-key-password'
    }
}
```
And inside `buildTypes { release { ... } }`, change the signing configuration to:
```groovy
signingConfig signingConfigs.release
```

### 3. Compile the Release Build:
Run the release compiler:
```bash
cd android && ./gradlew assembleRelease
```

### 📍 Output Location:
Once completed, your signed release APK is located at:
`mobile/android/app/build/outputs/apk/release/app-release.apk`

---

## 🧹 Step 4: Cleaning Up & Rebuilding
If you change package names, icons, splash screens, or other values in `app.json` and want to refresh the native directories cleanly:
```bash
npx expo prebuild --clean --platform android
```
This deletes the old native folder and recreates it with your latest changes before building!
