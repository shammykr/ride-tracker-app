//
// Exposes the React Native Objective-C APIs used by the Swift native modules.
//

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import <RNCPushNotificationIOS.h>

// Registers a native module class with React Native. This is the function the
// RCT_EXPORT_MODULE macro calls; declaring it here lets the Swift modules
// register themselves without any Objective-C glue files.
RCT_EXTERN void RCTRegisterModule(Class);
