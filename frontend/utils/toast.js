import { Alert, Platform, ToastAndroid } from "react-native"

export const showToast = (message, title = "Aegis") => {
  if (Platform.OS === "android") {
    ToastAndroid.show(message, ToastAndroid.SHORT)
    return
  }

  Alert.alert(title, message)
}
