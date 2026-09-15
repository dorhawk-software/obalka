package com.obalkadatovaschranka.transfer

import android.view.WindowManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * The phone-to-phone transfer, and nothing more (025 T008).
 *
 * Everything this module can reach is a DIRECTORY PATH and a PHRASE. It cannot be handed an archive,
 * a snapshot or a passphrase, because there is no method that takes one — which is how FR-001 is
 * enforced rather than promised. What it moves has already been sealed by the time it gets here.
 *
 * The Go side is loaded REFLECTIVELY, on purpose. `obalkatransfer.aar` is built by
 * `scripts/build-transfer-aar.sh` and is deliberately not committed, so a developer who never
 * touches this feature never installs Go or the NDK. Linking against the class directly would make
 * the whole app fail to compile without it; asking for it by name at runtime means its absence is
 * one feature quietly missing, which is the rule `bulkCipher.ts` follows for the same reason
 * (FR-013).
 */
class TransferModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  companion object {
    const val NAME = "ObalkaTransfer"
    /**
     * Progress events. Carries `{ runId, stage, sent, total, relayed }` and nothing about the content.
     * The run id is there so a stopped run still winding down cannot move the bar of the next one.
     */
    private const val EVENT = "ObalkaTransfer:progress"
    private const val GO_CLASS = "obalkatransfer.Obalkatransfer"
  }

  override fun getName() = NAME

  /** One transfer at a time: the Go receiver sets the process working directory. */
  private val worker = Executors.newSingleThreadExecutor()

  /**
   * One stop flag PER RUN, keyed by the id the TypeScript side gave it (025 review, 2026-09-15).
   *
   * It used to be a single flag, reset whenever a run was REQUESTED. Both halves of that were wrong.
   * The worker runs one transfer at a time, so a run requested while a stopped one was still winding
   * down un-stopped the old run; and the old run's JS interval kept setting the flag until that run
   * settled, which then stopped the new one as soon as it started. A flag per run can only ever stop
   * the run it names. Registered when the run is requested, so a stop issued while it is still queued
   * behind another is kept, and removed when the run ends, so the map holds only live runs.
   */
  private val runs = ConcurrentHashMap<String, AtomicBoolean>()

  private fun goClass(): Class<*>? =
      try {
        Class.forName(GO_CLASS)
      } catch (_: Throwable) {
        // Not an error: this build simply has no transfer. See the class comment.
        null
      }

  @ReactMethod
  fun available(promise: Promise) {
    promise.resolve(goClass() != null)
  }

  /**
   * Ask one run to stop. Cooperative, checked between steps on the Go side.
   *
   * A run that has already ended is no longer in the map, so a late stop for it reaches nothing -
   * least of all whichever transfer happens to be running by then.
   */
  @ReactMethod
  fun cancel(runId: String) {
    runs[runId]?.set(true)
  }

  /**
   * Keep the display on while a transfer is live, or let it time out again (FR-014).
   *
   * Android pauses the activity when the display times out, the screen stops the transfer when the
   * app reaches the background, and a transfer of a whole archive easily outlasts a 30-second
   * timeout. A window flag rather than a wake lock: it needs no permission, it holds only while this
   * activity is in front, and the system drops it with the window, so a crash cannot leave the phone
   * lit. Window flags belong to the UI thread. Best effort, like `SystemBarsModule`: with no activity
   * in front there is no display to keep on.
   */
  @ReactMethod
  fun keepScreenOn(on: Boolean) {
    val activity = reactContext.currentActivity ?: return
    activity.runOnUiThread {
      try {
        val window = activity.window ?: return@runOnUiThread
        if (on) {
          window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        } else {
          window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
      } catch (_: Throwable) {
        // A window torn down between the call and this line has no display to keep on.
      }
    }
  }

  @ReactMethod
  fun send(runId: String, dir: String, secret: String, onlyLocal: Boolean, promise: Promise) =
      run("send", runId, dir, secret, onlyLocal, promise)

  @ReactMethod
  fun receive(runId: String, dir: String, secret: String, onlyLocal: Boolean, promise: Promise) =
      run("receive", runId, dir, secret, onlyLocal, promise)

  private fun run(
      which: String,
      runId: String,
      dir: String,
      secret: String,
      onlyLocal: Boolean,
      promise: Promise,
  ) {
    val go = goClass()
    if (go == null) {
      promise.reject("unavailable", "This build cannot transfer between phones.")
      return
    }
    val cancelled = AtomicBoolean(false)
    if (runs.putIfAbsent(runId, cancelled) != null) {
      // The TypeScript side mints a fresh id per run, so this is a caller bug - refused rather than
      // letting two runs share one flag, which is the defect the map exists to remove.
      promise.reject("failed", "A transfer with this id is already running.")
      return
    }
    try {
      worker.execute {
        try {
          // Stopped while it waited behind the previous run. Starting it anyway would open a relay
          // connection for as long as croc takes to notice a flag that is already set.
          if (cancelled.get()) {
            promise.reject("cancelled", "The transfer was stopped.")
            return@execute
          }
          // Only a class of the boot class path has no loader, and the Go binding is never one.
          val loader = checkNotNull(go.classLoader) { "The transfer classes have no class loader." }
          val progress = progressProxy(loader, runId)
          val canceller = cancellerProxy(loader, cancelled)
          val method =
              go.getMethod(
                  which,
                  String::class.java,
                  String::class.java,
                  Boolean::class.javaPrimitiveType,
                  Class.forName("obalkatransfer.Progress", true, loader),
                  Class.forName("obalkatransfer.Canceller", true, loader),
              )
          method.invoke(null, dir, secret, onlyLocal, progress, canceller)
          promise.resolve(null)
        } catch (e: Throwable) {
          // gomobile surfaces a Go error as an exception; reflection wraps it once more.
          val cause = e.cause ?: e
          val message = cause.message ?: "The transfer failed."
          // A stopped run ends in whatever error croc gives up with ("context canceled"), and that
          // is the stop arriving rather than a broken transfer. A refused phrase is its own outcome
          // with its own remedy. The TypeScript side turns each code into the sentence the user
          // reads (FR-006).
          val code =
              when {
                cancelled.get() -> "cancelled"
                message.contains("phrase refused", true) -> "phrase"
                else -> "failed"
              }
          promise.reject(code, message)
        } finally {
          runs.remove(runId, cancelled)
        }
      }
    } catch (e: Throwable) {
      // The executor refused the run. Nothing else would ever remove its flag.
      runs.remove(runId, cancelled)
      promise.reject("failed", e.message ?: "The transfer could not be started.")
    }
  }

  /** Go calls this as bytes move. Nothing about the CONTENT crosses — a stage and two counts. */
  private fun progressProxy(loader: ClassLoader, runId: String): Any =
      java.lang.reflect.Proxy.newProxyInstance(
          loader,
          arrayOf(Class.forName("obalkatransfer.Progress", true, loader)),
      ) { _, method, args ->
        when (method.name) {
          "step" -> {
            emit(runId, args[0] as String, (args[1] as Long), (args[2] as Long), null)
            null
          }
          "relayed" -> {
            emit(runId, null, null, null, args[0] as Boolean)
            null
          }
          else -> null
        }
      }

  /** Answers for ONE run's flag, so no other run's stop can reach this transfer. */
  private fun cancellerProxy(loader: ClassLoader, cancelled: AtomicBoolean): Any =
      java.lang.reflect.Proxy.newProxyInstance(
          loader,
          arrayOf(Class.forName("obalkatransfer.Canceller", true, loader)),
      ) { _, method, _ ->
        if (method.name == "cancelled") cancelled.get() else null
      }

  private fun emit(runId: String, stage: String?, sent: Long?, total: Long?, relayed: Boolean?) {
    val payload = Arguments.createMap()
    payload.putString("runId", runId)
    stage?.let { payload.putString("stage", it) }
    sent?.let { payload.putDouble("sent", it.toDouble()) }
    total?.let { payload.putDouble("total", it.toDouble()) }
    relayed?.let { payload.putBoolean("relayed", it) }
    reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(EVENT, payload)
  }
}
