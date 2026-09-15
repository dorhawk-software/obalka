package com.obalkadatovaschranka.systembars

import android.content.Context
import androidx.core.view.WindowInsetsControllerCompat
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * The half of the system chrome that React Native's `StatusBar` does not reach (audit 2026-09-09).
 *
 * The app targets SDK 36, so edge-to-edge is enforced and RN calls `Window.enableEdgeToEdge()` for
 * us. That helper decides the NAVIGATION bar's icon appearance like this:
 *
 *     insetsController.isAppearanceLightNavigationBars = !UiModeUtils.isDarkMode(context)
 *
 * — from `Configuration.UI_MODE_NIGHT_MASK`, which is the **operating system's** appearance, and it
 * runs exactly once, from `ReactActivityDelegate.onCreate`. This app lets the user pick light, dark
 * or system independently of the OS, so two things went wrong and neither was recoverable from JS:
 *
 *   1. Choose Light on a phone that is in Dark and the gesture pill stays light — over `#F4EEE2`
 *      paper. Under gesture navigation Android draws no contrast scrim, so the handle is invisible.
 *   2. `android:configChanges` includes `uiMode`, so flipping the OS theme never re-creates the
 *      Activity, so `enableEdgeToEdge()` never runs again. Even in "system" mode the whole app
 *      repaints and the navigation bar keeps the appearance it was born with until the process dies.
 *
 * The status bar had neither problem because `<StatusBar barStyle>` re-applies on every render. This
 * gives the navigation bar the same treatment, driven from the same resolved `isDark`.
 *
 * It also remembers that appearance, which is what kills the launch flash. Settings live in the
 * encrypted database behind an async read, so until it resolves the app cannot know which theme was
 * chosen and paints its first frame in the OS's — a user who picked Light on a dark phone saw dark
 * window → dark blank frame → light app, on every cold start. The resolved appearance is written
 * here on every change and read back synchronously as a constant, so the first frame is right.
 */
class SystemBarsModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  companion object {
    const val NAME = "SystemBars"

    /** Shared with [com.obalkadatovaschranka.MainActivity], which paints the window before RN loads. */
    const val PREFS = "obalka_appearance"
    const val KEY_DARK = "isDark"

    /**
     * Whether the last run ended in dark mode, or `null` on a first launch (or after clearing data),
     * where following the OS is the only honest guess.
     */
    @JvmStatic
    fun lastAppearanceIsDark(context: Context): Boolean? {
      val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      return if (prefs.contains(KEY_DARK)) prefs.getBoolean(KEY_DARK, false) else null
    }
  }

  override fun getName(): String = NAME

  /**
   * Read once, synchronously, when the JS module is first required — so `App` can paint its
   * pre-settings frame in the appearance the user actually chose instead of the OS's.
   */
  override fun getConstants(): Map<String, Any?> =
      mapOf("lastAppearanceIsDark" to lastAppearanceIsDark(reactContext))

  /**
   * Point the navigation bar's icons at the app's own appearance, and remember it for the next cold
   * start.
   *
   * Best-effort by contract: a window that has gone away between the render and this call is a
   * no-op, never an error a user has to read. Nothing about the app's correctness depends on it.
   */
  @ReactMethod
  fun setAppearance(isDark: Boolean) {
    reactContext
        .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        .edit()
        .putBoolean(KEY_DARK, isDark)
        .apply()

    val activity = reactContext.currentActivity ?: return
    activity.runOnUiThread {
      try {
        val window = activity.window ?: return@runOnUiThread
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        // Light BARS means dark ICONS on them — the same inversion `barStyle: 'dark-content'` names.
        controller.isAppearanceLightNavigationBars = !isDark
        // The status bar is already driven by RN's StatusBar module; setting it here too keeps the
        // two edges in step if that component is ever unmounted mid-session.
        controller.isAppearanceLightStatusBars = !isDark
      } catch (e: Throwable) {
        // Torn-down window, or an OEM controller that refuses. The app is unaffected.
      }
    }
  }
}
