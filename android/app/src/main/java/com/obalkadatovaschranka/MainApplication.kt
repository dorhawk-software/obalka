package com.obalkadatovaschranka

import android.app.Application
import com.facebook.react.PackageList
import com.obalkadatovaschranka.transfer.TransferPackage
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.obalkadatovaschranka.share.ShareFilePackage
import com.obalkadatovaschranka.sms.SmsUserConsentPackage
import com.obalkadatovaschranka.systembars.SystemBarsPackage

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // The app's own module (021): Android's SMS User Consent API, so an ISDS one-time code can
          // reach the login field without the user leaving the app — and without this app ever
          // holding an SMS permission. Not autolinked because it is not a package, it is ours.
          add(SmsUserConsentPackage())
          // The app's second own module (audit 2026-09-09): the navigation bar's icon appearance,
          // which RN sets once from the OS theme and never again — see SystemBarsModule.
          add(SystemBarsPackage())
          add(TransferPackage())
          // Sharing a file (023, 2026-09-15): ACTION_SEND through the system chooser - see ShareFileModule.
          add(ShareFilePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
