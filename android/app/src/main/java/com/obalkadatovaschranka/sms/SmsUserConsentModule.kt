package com.obalkadatovaschranka.sms

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.gms.auth.api.phone.SmsRetriever
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.common.api.Status

/**
 * Android's SMS User Consent API, and nothing more (feature 021).
 *
 * The app declares NO SMS permission and never reads the inbox. This asks Google Play services to
 * watch for ONE incoming message for up to five minutes; when one arrives, the SYSTEM shows a prompt
 * naming the sender, and only if the user agrees does the text reach this process — once, for that
 * message alone.
 *
 * SMS Retriever (the fully automatic sibling) is not usable here: it requires an 11-character hash of
 * our signing key inside the message body, and the message is composed by Česká pošta.
 *
 * Everything here is best-effort by contract. A phone without Play services, an OS that refuses, a
 * consent the user declines — all of them end as "no code", never as an error the user has to read.
 */
class SmsUserConsentModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener, LifecycleEventListener {

  companion object {
    const val NAME = "SmsUserConsent"
    /** Arbitrary, module-local: identifies our own consent dialog coming back. */
    private const val CONSENT_REQUEST = 0x5354
    /** The single event JS listens on. Carries `{ message }` — never anything else. */
    private const val EVENT = "SmsUserConsent:message"
  }

  private var receiver: BroadcastReceiver? = null
  /**
   * Whether JS still wants codes. Distinct from having a receiver registered, because a consent
   * result ENDS one watch: the API grants access to a single message, so after every result — allowed
   * or declined — the watch has to be started again for the next one. Without that, a resent code
   * (the "Poslat kód znovu" button is right there) would never be offered again, and neither would a
   * message the user declined by mistake.
   */
  private var listening = false

  override fun getName(): String = NAME

  init {
    reactContext.addActivityEventListener(this)
    reactContext.addLifecycleEventListener(this)
  }

  /**
   * Start listening for one message.
   *
   * Resolves `true` when Play services accepted the request, `false` when this device cannot do it —
   * a de-Googled phone is a normal outcome, not a failure, and the screen simply behaves as it always
   * did. Never rejects: an OTP screen must not show an error about a convenience.
   */
  @ReactMethod
  fun start(promise: Promise) {
    try {
      listening = true
      registerReceiver()
      // `null` = any sender. The consent prompt names the sender to the user, who is the one deciding;
      // pinning a number here would break the moment Česká pošta sends from a different one.
      SmsRetriever.getClient(reactContext)
          .startSmsUserConsent(null)
          .addOnSuccessListener { promise.resolve(true) }
          .addOnFailureListener {
            listening = false
            unregisterReceiver()
            promise.resolve(false)
          }
    } catch (e: Throwable) {
      listening = false
      unregisterReceiver()
      promise.resolve(false)
    }
  }

  /** Stop listening. Idempotent, and called whenever the code screen goes away. */
  @ReactMethod
  fun stop(promise: Promise?) {
    listening = false
    unregisterReceiver()
    promise?.resolve(true)
  }

  /** Required by RN for `NativeEventEmitter`; the counting is JS-side. */
  @ReactMethod fun addListener(eventName: String?) = Unit

  @ReactMethod fun removeListeners(count: Double) = Unit

  private fun registerReceiver() {
    if (receiver != null) {
      return
    }
    val r =
        object : BroadcastReceiver() {
          override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action != SmsRetriever.SMS_RETRIEVED_ACTION) {
              return
            }
            val extras = intent.extras ?: return
            val status =
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                  extras.getParcelable(SmsRetriever.EXTRA_STATUS, Status::class.java)
                } else {
                  @Suppress("DEPRECATION") extras.getParcelable(SmsRetriever.EXTRA_STATUS)
                }
            if (status?.statusCode != CommonStatusCodes.SUCCESS) {
              // Timed out after five minutes, or something we cannot act on. The watch is over
              // either way, so arm the next one if the screen is still open.
              unregisterReceiver()
              rearm()
              return
            }
            val consent =
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                  extras.getParcelable(SmsRetriever.EXTRA_CONSENT_INTENT, Intent::class.java)
                } else {
                  @Suppress("DEPRECATION")
                  extras.getParcelable<Intent>(SmsRetriever.EXTRA_CONSENT_INTENT)
                }
            val activity = reactContext.currentActivity
            if (consent == null || activity == null) {
              return
            }
            try {
              // THE user's decision, taken in the system's own dialog. This app cannot see the message
              // unless they say yes here.
              activity.startActivityForResult(consent, CONSENT_REQUEST)
            } catch (e: Throwable) {
              // A consent intent we cannot launch is a missed convenience, not a failure to report.
            }
          }
        }
    val filter = IntentFilter(SmsRetriever.SMS_RETRIEVED_ACTION)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      reactContext.registerReceiver(r, filter, SmsRetriever.SEND_PERMISSION, null, Context.RECEIVER_EXPORTED)
    } else {
      @Suppress("UnspecifiedRegisterReceiverFlag")
      reactContext.registerReceiver(r, filter, SmsRetriever.SEND_PERMISSION, null)
    }
    receiver = r
  }

  private fun unregisterReceiver() {
    val r = receiver ?: return
    receiver = null
    try {
      reactContext.unregisterReceiver(r)
    } catch (e: Throwable) {
      // Already gone (process death, double stop) — nothing to undo.
    }
  }

  override fun onActivityResult(
      activity: Activity,
      requestCode: Int,
      resultCode: Int,
      data: Intent?
  ) {
    if (requestCode != CONSENT_REQUEST) {
      return
    }
    // Consent covers ONE message, so this watch is finished whatever the user chose. Arm the next
    // one — a declined prompt or a resent code must still be offerable.
    unregisterReceiver()
    rearm()
    if (resultCode != Activity.RESULT_OK) {
      return // declined — say nothing, change nothing
    }
    val message = data?.getStringExtra(SmsRetriever.EXTRA_SMS_MESSAGE) ?: return
    val payload = Arguments.createMap().apply { putString("message", message) }
    try {
      reactContext
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit(EVENT, payload)
    } catch (e: Throwable) {
      // The JS side is gone (screen closed mid-prompt). Dropping it is the correct outcome.
    }
  }

  /** Start the next watch, if JS has not stopped listening in the meantime. */
  private fun rearm() {
    if (!listening) {
      return
    }
    try {
      registerReceiver()
      SmsRetriever.getClient(reactContext).startSmsUserConsent(null).addOnFailureListener {
        unregisterReceiver()
      }
    } catch (e: Throwable) {
      unregisterReceiver()
    }
  }

  override fun onNewIntent(intent: Intent) = Unit

  /** Backgrounding the app ends the wait — this app listens only while its code screen is in front. */
  override fun onHostPause() {
    // Note this does NOT clear `listening`: the consent dialog itself backgrounds the app, and the
    // watch must survive being pushed behind the very prompt it caused.
    unregisterReceiver()
  }

  override fun onHostResume() = rearm()

  override fun onHostDestroy() {
    listening = false
    unregisterReceiver()
  }

  override fun invalidate() {
    listening = false
    unregisterReceiver()
    super.invalidate()
  }
}
