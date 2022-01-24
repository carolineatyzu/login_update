import PushNotification from 'react-native-push-notification';
import SajjadLaunchApplication from 'react-native-launch-application';
// another alternative which i didnt use (https://www.npmjs.com/package/react-native-open-app)

PushNotification.configure({
  // (required) Called when a remote or local notification is opened or received
  onNotification: function(notification) {
    SajjadLaunchApplication.open("com.lba");
    console.log(notification.store);
  },

  popInitialNotification: true,
  requestPermissions: true,
  largeIcon: "ic_app_icon",
  smallIcon: "ic_app_icon",
})

export const LocalNotification = (notification_title, notification_text, nearby_store) => {
  PushNotification.localNotification({
    autoCancel: true,
    bigText:
      notification_text,
    subText: notification_title,
    title: notification_title,
    message: 'Expand to see more',
    vibrate: true,
    vibration: 300,
    playSound: true,
    soundName: 'default',
    largeIcon: "ic_app_icon",
  	smallIcon: "ic_app_icon",
    store: nearby_store
  })
}

export const ScheduledLocalNotification = () => {
  PushNotification.localNotificationSchedule({
    autoCancel: true,
    bigText:
      'This is local notification demo in React Native app. Only shown, when expanded.',
    subText: 'Local Notification Demo',
    title: 'Scheduled Notification Title',
    message: 'Scheduled Notification Message',
    vibrate: true,
    vibration: 500,
    playSound: true,
    soundName: 'default',
    actions: '["Yes", "No"]',
    date: new Date(Date.now() + 3 * 1000) // in 3 secs
  })
}
