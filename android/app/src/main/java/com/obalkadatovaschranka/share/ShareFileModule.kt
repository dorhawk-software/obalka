package com.obalkadatovaschranka.share

import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.Intent
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

/**
 * Hands a file on this phone to Android's share sheet (023; found walking the emulator 2026-09-15).
 *
 * The debug bundle used to be offered with react-native-blob-util's `actionViewIntent`, which is
 * ACTION_VIEW: "open this zip with an app". A phone with no zip viewer had nothing to open it with,
 * so sharing failed every time, and a phone with one would have opened the bundle rather than sent
 * it. Sharing is ACTION_SEND, and neither React Native's `Share` (text and links only on Android)
 * nor blob-util can attach a file to it - hence this module, the app's own.
 *
 * The file leaves through a content:// URI from the FileProvider react-native-blob-util already
 * registers (`${applicationId}.provider`, covering the app's files, cache and external directories),
 * with read access granted only to the app the user picks. The app learns nothing about where the
 * file went: the promise settles once the sheet is up, never when anything is sent.
 */
class ShareFileModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  companion object {
    const val NAME = "ShareFile"
  }

  override fun getName(): String = NAME

  @ReactMethod
  fun shareFile(path: String, mimeType: String, title: String, promise: Promise) {
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.reject("E_NO_ACTIVITY", "There is no screen to show the share sheet on")
      return
    }
    val file = File(path.removePrefix("file://"))
    if (!file.isFile) {
      promise.reject("E_NO_FILE", "The file to share is not on the phone")
      return
    }
    val uri =
        try {
          FileProvider.getUriForFile(reactContext, "${reactContext.packageName}.provider", file)
        } catch (e: IllegalArgumentException) {
          // Outside the provider's directories. A bundle never is - it lives under files/ - so this
          // is a caller's mistake, said as one rather than as a sheet that silently does not open.
          promise.reject("E_NOT_SHAREABLE", e)
          return
        }
    val send =
        Intent(Intent.ACTION_SEND).apply {
          type = mimeType
          putExtra(Intent.EXTRA_STREAM, uri)
          // ClipData as well as the extra: the chooser passes the read grant on to the picked app
          // only for URIs it can see there.
          clipData = ClipData.newRawUri("", uri)
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
    val chooser =
        Intent.createChooser(send, title).apply { addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION) }
    activity.runOnUiThread {
      try {
        activity.startActivity(chooser)
        promise.resolve(null)
      } catch (e: ActivityNotFoundException) {
        promise.reject("E_NO_TARGET", e)
      } catch (e: RuntimeException) {
        promise.reject("E_SHARE", e)
      }
    }
  }
}
