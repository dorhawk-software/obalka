package com.obalkadatovaschranka

import android.graphics.drawable.ColorDrawable
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.widget.FrameLayout
import android.widget.ImageView
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.obalkadatovaschranka.systembars.SystemBarsModule

class MainActivity : ReactActivity() {

  private companion object {
    /** `lightTheme.bg` and `darkTheme.bg` from `src/theme/theme.ts` — the warm paper, both ways. */
    const val PAPER_LIGHT = 0xFFF4EEE2.toInt()
    const val PAPER_DARK = 0xFF1A1712.toInt()

    /** Matches the 96pt mark on the iOS launch screen closely enough at typical densities. */
    const val LOGO_PX = 288
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "ObalkaDatovaSchranka"

  /**
   * Discard Android's saved instance state on re-creation — `react-native-screens` requires it, and
   * without it the app CRASHES whenever the system restores it after killing the process.
   *
   * Android saves the fragment back-stack and replays it into a fresh Activity. `ScreenStackFragment`
   * cannot be rebuilt that way (it has no no-arg constructor), so the restore throws
   * `Fragment$InstantiationException` before any JavaScript runs. React Navigation rebuilds the whole
   * stack from JS anyway, so there is nothing in that saved state worth keeping.
   *
   * Found by tapping a reminder notification with the app's process dead (010 T035) — the app started
   * and immediately died on the crash dialog. But the notification was only the trigger: the same
   * crash was reachable by anything that re-creates the Activity after a process kill, which on a
   * phone means "the user came back to the app a few hours later". It had simply never been tested,
   * because a debug build launched from the launcher or from Metro never has a saved state to restore.
   */
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
    paintWindowForLastAppearance()
    secureRecentsPreview()
    hideOtherAppsOverlays()
  }

  /**
   * Keep the mail out of the image the system keeps of this app, while leaving screenshots working.
   *
   * Tapping recents used to show the inbox: sender names, subjects and the box identity line,
   * readable by anyone holding an unlocked phone. The app lock could not prevent it, because the JS
   * gate reacts to `AppState` and the system captures the task around the activity stopping. React
   * is told afterwards, so this has to be native.
   *
   * Android 13 added the API that does exactly this and nothing more. Its own docs draw the line:
   * unlike `FLAG_SECURE` it "only affects the behavior when the activity's screenshot would be used
   * as a representation ... in Overview. The system may still take screenshots of the activity in
   * other contexts; for example, when the user takes a screenshot of the entire screen."
   *
   * What it does NOT do is blank the live surface the switcher renders while the app is still
   * resident, so the inbox is briefly visible if you open the switcher straight from the app and
   * look. That is deliberate, and it is what real secure apps do: George, Revolut and Wallet all
   * behave the same way on iOS. They protect the image that gets STORED, because that is the one
   * that outlives the moment and can be seen by somebody who is not you. The cover below therefore
   * exists only where there is no such API, on API 32 and older, and there it has to hang on window
   * focus, which is the only hook that runs before the preview is made.
   *
   * DO NOT replace any of this with `FLAG_SECURE`: it covers everything in one line and takes the
   * user's own screenshots with it, which this app will not do. DO NOT "fix" older versions by
   * toggling `FLAG_SECURE` in `onPause` either: the preview already exists by the time the flag
   * lands, so the app looks protected while the card still holds the inbox.
   *
   * Not conditional on the app-lock setting. Whoever opens recents is not necessarily whoever owns
   * the mailbox.
   */
  private fun secureRecentsPreview() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      setRecentsScreenshotEnabled(false)
    }
  }

  /** True where there is no `setRecentsScreenshotEnabled`, so the cover is the only protection. */
  private val needsManualCover: Boolean
    get() = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU

  /**
   * Hide overlays drawn over this app by other apps, while it is in the foreground.
   *
   * An overlay attack draws a convincing control on top of a real one, so the tap that looks like it
   * lands on this app lands on something else, or the value that looks like this app's is not. OWASP
   * MASTG lists it as a platform risk for exactly this kind of app (MASTG-BEST-0040), and Android 12
   * gave it a real answer instead of the older per-view touch filtering.
   *
   * Needs `android.permission.HIDE_OVERLAY_WINDOWS`, which is normal-level: it is granted at install
   * and never prompts, because it takes capability away from other apps rather than giving any to
   * this one.
   */
  private fun hideOtherAppsOverlays() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      window.setHideOverlayWindows(true)
    }
  }

  /** The stand-in shown on pre-13 devices while this window is not the focused one. */
  private var privacyCover: View? = null

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (!needsManualCover) return
    if (hasFocus) hidePrivacyCover() else showPrivacyCover()
  }

  private fun showPrivacyCover() {
    if (privacyCover != null) return
    val root = window?.decorView as? ViewGroup ?: return
    val isDark = SystemBarsModule.lastAppearanceIsDark(this) ?: false

    // The same thing the launch window shows: paper, with the mark centred on it. iOS instantiates
    // its actual launch screen for this; here the two are assembled from the same pieces.
    val cover = FrameLayout(this).apply {
      setBackgroundColor(if (isDark) PAPER_DARK else PAPER_LIGHT)
      layoutParams = ViewGroup.LayoutParams(MATCH_PARENT, MATCH_PARENT)
      isClickable = false
      addView(
        ImageView(context).apply {
          setImageResource(R.mipmap.ic_launcher)
          layoutParams = FrameLayout.LayoutParams(LOGO_PX, LOGO_PX, Gravity.CENTER)
        },
      )
    }
    root.addView(cover)
    privacyCover = cover
  }

  private fun hidePrivacyCover() {
    privacyCover?.let { (it.parent as? ViewGroup)?.removeView(it) }
    privacyCover = null
  }

  /**
   * Paint the window in the appearance the user last chose, before any JavaScript runs.
   *
   * `AppTheme` inherits `Theme.AppCompat.DayNight`, so the window Android shows between the launcher
   * and the first React frame follows the **OS** theme. The app's own light/dark choice is
   * independent of that and lives behind an async read of the encrypted database, so a user who
   * picked Light on a dark phone got: dark window → blank frame in the OS scheme → light app. Two
   * flashes on every cold start, and the same in reverse for the opposite pairing.
   *
   * `SystemBarsModule` writes the resolved appearance to SharedPreferences whenever it changes, and
   * this reads it back synchronously — the one thing available this early. On a first launch there
   * is nothing stored and the DayNight window is left exactly as it was, which is the right guess
   * when the app has no choice to honour yet.
   */
  private fun paintWindowForLastAppearance() {
    val isDark = SystemBarsModule.lastAppearanceIsDark(this) ?: return
    window?.setBackgroundDrawable(ColorDrawable(if (isDark) PAPER_DARK else PAPER_LIGHT))
  }

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
