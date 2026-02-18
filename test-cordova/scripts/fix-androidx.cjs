#!/usr/bin/env node
/**
 * Cordova after_prepare hook that patches the cordova-plugin-browsertab plugin
 * for compatibility with cordova-android 14+ and AndroidX.
 *
 * The upstream plugin (v0.2.0) uses the deprecated android.support library and
 * references the removed `cdvMinSdkVersion` Gradle property. This hook:
 *
 * 1. Replaces the `android.support.customtabs` import with `androidx.browser.customtabs`
 *    in the deployed BrowserTab.java.
 * 2. Replaces the `com.android.support:customtabs` dependency with `androidx.browser:browser`
 *    in the deployed build.gradle.
 * 3. Neutralises the BrowserTab.gradle script that references the removed
 *    `cdvMinSdkVersion` property.
 */

const fs = require('fs');
const path = require('path');

const projectRoot = process.argv[2] || process.cwd();
const androidDir = path.join(projectRoot, 'platforms', 'android');

if (!fs.existsSync(androidDir)) {
  return;
}

// 1. Fix BrowserTab.java import.
const javaFile = path.join(
  androidDir, 'app', 'src', 'main', 'java',
  'com', 'google', 'cordova', 'plugin', 'BrowserTab.java'
);

if (fs.existsSync(javaFile)) {
  let content = fs.readFileSync(javaFile, 'utf8');
  const oldImport = 'import android.support.customtabs.CustomTabsIntent;';
  const newImport = 'import androidx.browser.customtabs.CustomTabsIntent;';

  if (content.includes(oldImport)) {
    content = content.replace(oldImport, newImport);
    fs.writeFileSync(javaFile, content);
    console.log('[hook] Fixed BrowserTab.java: android.support → androidx.browser');
  }
}

// 2. Fix build.gradle dependency.
const buildGradle = path.join(androidDir, 'app', 'build.gradle');

if (fs.existsSync(buildGradle)) {
  let content = fs.readFileSync(buildGradle, 'utf8');
  const oldDep = 'com.android.support:customtabs:23.3.0';
  const newDep = 'androidx.browser:browser:1.8.0';

  if (content.includes(oldDep)) {
    content = content.replace(oldDep, newDep);
    fs.writeFileSync(buildGradle, content);
    console.log('[hook] Fixed build.gradle: com.android.support → androidx.browser');
  }
}

// 3. Neutralise BrowserTab.gradle (references removed cdvMinSdkVersion).
const pluginGradle = path.join(
  androidDir, 'cordova-plugin-browsertab', 'jstest-BrowserTab.gradle'
);

if (fs.existsSync(pluginGradle)) {
  let content = fs.readFileSync(pluginGradle, 'utf8');

  if (content.includes('cdvMinSdkVersion')) {
    fs.writeFileSync(
      pluginGradle,
      '// cordova-android 14+ uses cordovaConfig; plugin min SDK 16 is covered by cordova-android 24\n'
    );
    console.log('[hook] Neutralised BrowserTab.gradle (cdvMinSdkVersion removed in cordova-android 14)');
  }
}
