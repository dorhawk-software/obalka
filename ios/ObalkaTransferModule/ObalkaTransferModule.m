// The phone-to-phone transfer on iOS, and nothing more (025 T022).
//
// The iOS twin of android/.../transfer/TransferModule.kt, and deliberately the same module in every
// way the JavaScript side can see: the name `ObalkaTransfer`, the methods `available`, `send`,
// `receive`, `cancel` and `keepScreenOn` with the same arguments, the event `ObalkaTransfer:progress`
// carrying `{ runId, stage, sent, total, relayed }`, and the rejection codes `cancelled`, `phrase`,
// `failed`. src/services/transfer/nativeTransport.ts is the only reader, and it does not ask which
// platform it is on. A legacy bridge module, like the Android one, reached through the New
// Architecture's interop layer.
//
// Everything this module can reach is a DIRECTORY PATH and a PHRASE (FR-001): there is no method
// that takes an archive, a snapshot or a passphrase.
//
// Compiled only when the Go archive is linked (OBALKA_TRANSFER_LINKED, set by the podspec when
// Obalkatransfer.xcframework is present). Without it there is no module at all, so
// `NativeModules.ObalkaTransfer` is undefined and the app hides the transfer (FR-013) - the iOS
// counterpart of Android loading its archive reflectively. `available` therefore always answers yes
// here; it exists so the two modules have one contract.

#if OBALKA_TRANSFER_LINKED

#import <UIKit/UIKit.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import <Obalkatransfer/Obalkatransfer.h>

static NSString *const OBTEvent = @"ObalkaTransfer:progress";

#pragma mark - One run's stop flag

/// Answers croc's `Canceller` for ONE run, so no other run's stop can reach this transfer (025
/// review, 2026-09-15). Go polls it every 100 ms from its own threads, hence atomic.
@interface OBTRunFlag : NSObject <ObalkatransferCanceller>
@property (atomic) BOOL stopped;
@end

@implementation OBTRunFlag
- (BOOL)cancelled
{
  return self.stopped;
}
@end

#pragma mark - Background time for the end of a run

/// Asks iOS for time to END a run cleanly once the app is in the background - never to go on with it.
///
/// The transfer does not run in the background (FR-014): the transfer screen stops the run when the
/// app reaches `background`, the same path as its cancel button. What that stop still needs is a few
/// seconds - croc noticing the flag, closing its sockets, the promise settling, and the JavaScript
/// side sweeping the staged archive and recovery key off the disk. iOS suspends an app within
/// seconds of backgrounding, and a run frozen halfway through that would leave all of it for
/// whenever the app happens to come back. So each run holds a background task from start to end,
/// and if iOS runs out of patience first, the expiry stops the run itself.
@interface OBTBackgroundTime : NSObject
- (instancetype)initWithExpiry:(dispatch_block_t)onExpiry;
- (void)end;
@end

@implementation OBTBackgroundTime {
  UIBackgroundTaskIdentifier _task;
}

- (instancetype)initWithExpiry:(dispatch_block_t)onExpiry
{
  if ((self = [super init])) {
    _task = UIBackgroundTaskInvalid;
    __weak OBTBackgroundTime *weakSelf = self;
    // Safe off the main thread (UIApplication documents both calls as such); the expiry handler
    // itself arrives on the main thread and must end the task before it returns.
    UIBackgroundTaskIdentifier task =
        [UIApplication.sharedApplication beginBackgroundTaskWithName:@"ObalkaTransfer"
                                                   expirationHandler:^{
                                                     onExpiry();
                                                     [weakSelf end];
                                                   }];
    @synchronized(self) {
      _task = task;
    }
  }
  return self;
}

- (void)end
{
  UIBackgroundTaskIdentifier task;
  @synchronized(self) {
    task = _task;
    _task = UIBackgroundTaskInvalid;
  }
  if (task != UIBackgroundTaskInvalid) {
    [UIApplication.sharedApplication endBackgroundTask:task];
  }
}
@end

#pragma mark - The module

@interface ObalkaTransferModule : RCTEventEmitter <RCTBridgeModule>
- (void)emit:(NSDictionary *)body;
@end

/// Go calls this as bytes move. Nothing about the CONTENT crosses - a stage and two counts, or the
/// route once croc has settled on one.
@interface OBTProgress : NSObject <ObalkatransferProgress>
- (instancetype)initWithModule:(ObalkaTransferModule *)module runId:(NSString *)runId;
@end

@implementation OBTProgress {
  __weak ObalkaTransferModule *_module;
  NSString *_runId;
}

- (instancetype)initWithModule:(ObalkaTransferModule *)module runId:(NSString *)runId
{
  if ((self = [super init])) {
    _module = module;
    _runId = [runId copy];
  }
  return self;
}

- (void)step:(NSString *)stage sent:(int64_t)sent total:(int64_t)total
{
  NSMutableDictionary *body = [@{
    @"runId" : _runId,
    @"sent" : @((double)sent),
    @"total" : @((double)total),
  } mutableCopy];
  if (stage != nil) {
    body[@"stage"] = stage;
  }
  [_module emit:body];
}

- (void)relayed:(BOOL)via
{
  [_module emit:@{@"runId" : _runId, @"relayed" : @(via)}];
}
@end

@implementation ObalkaTransferModule {
  /// One transfer at a time: the Go receiver sets the process working directory.
  dispatch_queue_t _worker;
  /// One stop flag PER RUN, keyed by the id the TypeScript side gave it, registered when the run is
  /// requested (so a stop issued while it is queued is kept) and removed when it ends. Guarded by
  /// @synchronized on itself.
  NSMutableDictionary<NSString *, OBTRunFlag *> *_runs;
}

RCT_EXPORT_MODULE(ObalkaTransfer)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (instancetype)init
{
  if ((self = [super init])) {
    _worker = dispatch_queue_create("software.dorhawk.obalka.transfer", DISPATCH_QUEUE_SERIAL);
    _runs = [NSMutableDictionary new];
  }
  return self;
}

- (NSArray<NSString *> *)supportedEvents
{
  return @[ OBTEvent ];
}

/// Called from Go's threads. RCTEventEmitter drops the event while nothing listens and hands it to
/// the JavaScript thread otherwise, as it does for every module that emits from a worker.
- (void)emit:(NSDictionary *)body
{
  [self sendEventWithName:OBTEvent body:body];
}

/// A reload or teardown stops whatever is running, rather than leaving croc holding a relay
/// connection for a JavaScript side that no longer exists.
- (void)invalidate
{
  @synchronized(_runs) {
    for (OBTRunFlag *flag in _runs.allValues) {
      flag.stopped = YES;
    }
  }
  [super invalidate];
}

RCT_EXPORT_METHOD(available : (RCTPromiseResolveBlock)resolve reject : (RCTPromiseRejectBlock)reject)
{
  resolve(@YES);
}

/// Ask one run to stop. Cooperative, checked by Go between steps. A run that has already ended is
/// no longer in the map, so a late stop reaches nothing - least of all the next transfer.
RCT_EXPORT_METHOD(cancel : (NSString *)runId)
{
  @synchronized(_runs) {
    _runs[runId].stopped = YES;
  }
}

/// Keep the display on while a transfer is live, or let it sleep again (FR-014). iOS suspends the
/// app when the screen locks, and a whole archive easily outlasts auto-lock. The idle timer is
/// UIKit's, so it is set on the main thread. It holds only while this app is in front and dies with
/// the process, so a crash cannot leave the phone lit.
RCT_EXPORT_METHOD(keepScreenOn : (BOOL)on)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    UIApplication.sharedApplication.idleTimerDisabled = on;
  });
}

RCT_EXPORT_METHOD(send
                  : (NSString *)runId dir
                  : (NSString *)dir secret
                  : (NSString *)secret onlyLocal
                  : (BOOL)onlyLocal resolve
                  : (RCTPromiseResolveBlock)resolve reject
                  : (RCTPromiseRejectBlock)reject)
{
  [self run:YES runId:runId dir:dir secret:secret onlyLocal:onlyLocal resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(receive
                  : (NSString *)runId dir
                  : (NSString *)dir secret
                  : (NSString *)secret onlyLocal
                  : (BOOL)onlyLocal resolve
                  : (RCTPromiseResolveBlock)resolve reject
                  : (RCTPromiseRejectBlock)reject)
{
  [self run:NO runId:runId dir:dir secret:secret onlyLocal:onlyLocal resolve:resolve reject:reject];
}

- (void)run:(BOOL)sending
        runId:(NSString *)runId
          dir:(NSString *)dir
       secret:(NSString *)secret
    onlyLocal:(BOOL)onlyLocal
      resolve:(RCTPromiseResolveBlock)resolve
       reject:(RCTPromiseRejectBlock)reject
{
  OBTRunFlag *flag = [OBTRunFlag new];
  @synchronized(_runs) {
    if (_runs[runId] != nil) {
      // The TypeScript side mints a fresh id per run, so this is a caller bug - refused rather than
      // letting two runs share one flag.
      reject(@"failed", @"A transfer with this id is already running.", nil);
      return;
    }
    _runs[runId] = flag;
  }
  OBTBackgroundTime *time = [[OBTBackgroundTime alloc] initWithExpiry:^{
    flag.stopped = YES;
  }];
  OBTProgress *progress = [[OBTProgress alloc] initWithModule:self runId:runId];

  dispatch_async(_worker, ^{
    // Stopped while it waited behind the previous run: never open a relay connection for it.
    if (flag.stopped) {
      reject(@"cancelled", @"The transfer was stopped.", nil);
    } else {
      NSError *error = nil;
      BOOL ok = sending ? ObalkatransferSend(dir, secret, onlyLocal, progress, flag, &error)
                        : ObalkatransferReceive(dir, secret, onlyLocal, progress, flag, &error);
      if (ok) {
        resolve(nil);
      } else {
        // A stopped run ends in whatever error croc gives up with ("context canceled"), and that is
        // the stop arriving rather than a broken transfer. A refused phrase is its own outcome with
        // its own remedy (FR-006). Go's error text arrives as the NSError's description.
        NSString *message = error.localizedDescription ?: @"The transfer failed.";
        NSString *code = @"failed";
        if (flag.stopped) {
          code = @"cancelled";
        } else if ([message rangeOfString:@"phrase refused" options:NSCaseInsensitiveSearch].location !=
                   NSNotFound) {
          code = @"phrase";
        }
        reject(code, message, nil);
      }
    }
    @synchronized(self->_runs) {
      if (self->_runs[runId] == flag) {
        [self->_runs removeObjectForKey:runId];
      }
    }
    [time end];
  });
}

@end

#endif // OBALKA_TRANSFER_LINKED
