import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    // The window is made by SceneDelegate. Apps built with the iOS 27 SDK must adopt the UIScene
    // lifecycle: without a scene manifest UIKit stops the app at launch (EXC_BREAKPOINT in
    // `_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`), which Xcode 26 only warned about.
    return true
  }
}

/// The app's one window. `Info.plist` names this class in `UIApplicationSceneManifest`; the app has a
/// single scene (`UIApplicationSupportsMultipleScenes` is false), so this is where the app starts.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  /// Hides the UI whenever the app stops being frontmost, so the app switcher cannot show mail.
  ///
  /// This has to be native. The JS lock (`LockGate`) reacts to `AppState`, and by the time React has
  /// rendered anything the damage is done: swiping up makes the app INACTIVE and it is already on
  /// screen in the switcher, live, before `background` is ever delivered. iOS then persists that
  /// image to disk in the app container, so the leak outlives the moment. A JS re-render cannot win
  /// a race it only learns about afterwards.
  ///
  /// Deliberately NOT conditional on the app-lock setting. The snapshot is written to disk either
  /// way, and a reader who opens the switcher is not always the person who owns the mailbox.
  private var privacyCover: UIView?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let factory = (UIApplication.shared.delegate as? AppDelegate)?.reactNativeFactory else { return }

    let window = UIWindow(windowScene: windowScene)
    self.window = window

    // No launch options: under the scene lifecycle they arrive as `connectionOptions`, and the app
    // reads none of them (no URL scheme; a reminder's tap reaches notifee through
    // UNUserNotificationCenter, which does not depend on the lifecycle).
    factory.startReactNative(withModuleName: "ObalkaDatovaSchranka", in: window, launchOptions: nil)
  }

  // MARK: - App-switcher privacy

  // `didEnterBackground`, not `willResignActive`, and that is a deliberate step BACK from where this
  // started. Resign-active fires as the swipe-up begins, so it also blanks the app behind Control
  // Centre, the notification shade and the Face ID sheet. Checking the real thing settled it: George,
  // Revolut and Wallet all still show their content while the switcher is open and the app is
  // frontmost, and only cover once the app actually backgrounds. They are protecting the image iOS
  // WRITES TO DISK, which is the one that outlives the moment and can be seen by somebody else.
  //
  // iOS takes that snapshot after this method returns, so covering here is in time for it.
  //
  // Under the scene lifecycle UIKit sends these to the scene, never to the app delegate: left on
  // AppDelegate as `applicationDidEnterBackground` they would simply stop being called.
  func sceneDidEnterBackground(_ scene: UIScene) {
    showPrivacyCover()
  }

  func sceneDidBecomeActive(_ scene: UIScene) {
    hidePrivacyCover()
  }

  /// Kept alive for as long as its view is on screen; a storyboard's controller is not retained for us.
  private var privacyCoverController: UIViewController?

  private func showPrivacyCover() {
    guard privacyCover == nil, let window = window else { return }

    // The LAUNCH SCREEN itself, instantiated, rather than a hand-made lookalike. The card in the
    // switcher is then the same thing the app shows while it starts, by construction: brand the
    // launch screen and this follows, with no second place to remember. Falling back to the bare
    // colour keeps the privacy guarantee even if the storyboard is ever renamed.
    let cover: UIView
    if let vc = UIStoryboard(name: "LaunchScreen", bundle: nil).instantiateInitialViewController(),
       let view = vc.view {
      privacyCoverController = vc
      cover = view
    } else {
      cover = UIView()
      cover.backgroundColor = UIColor(named: "LaunchBackground") ?? .systemBackground
    }
    cover.frame = window.bounds
    cover.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    cover.isUserInteractionEnabled = false

    // Added to the WINDOW, not to the root view, and raised: a presented modal (share sheet, picker,
    // the document browser) lives in the window too, so covering only the root view would leave
    // whatever is on top of it in the snapshot.
    window.addSubview(cover)
    window.bringSubviewToFront(cover)
    privacyCover = cover
  }

  private func hidePrivacyCover() {
    privacyCover?.removeFromSuperview()
    privacyCover = nil
    privacyCoverController = nil
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
