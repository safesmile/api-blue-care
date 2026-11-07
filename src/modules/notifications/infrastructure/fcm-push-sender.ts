import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GoogleAuth } from "google-auth-library";
import { PushSender, type PushDelivery } from "../domain/push.repository";
/** FCM HTTP v1 with ADC and fixed Google endpoints; disabled without explicit configuration. */
@Injectable()
export class FcmPushSender extends PushSender {
  private readonly auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/firebase.messaging"] });
  /**
   * Recibe las dependencias de la operación.
   * @param config Dependencia tipada de config.
   */
  constructor(private readonly config: ConfigService) {
    super();
  }
  /**
   * Reports whether the push provider is explicitly enabled.
   * @returns The authorized result or completion of the operation.
   */
  available() {
    return this.config.get("PUSH_ENABLED") === "true";
  }
  /**
   * Sends a generic notification through FCM using ADC.
   * @param delivery Explicit delivery value for this operation.
   * @returns The authorized result or completion of the operation.
   */
  async send(delivery: PushDelivery): Promise<"sent" | "invalid"> {
    if (!this.available()) throw new Error("Push transport is disabled");
    try {
      const client = await this.auth.getClient();
      await client.request({
        url:
          "https://fcm.googleapis.com/v1/projects/" +
          this.config.getOrThrow<string>("FIREBASE_PROJECT_ID") +
          "/messages:send",
        method: "POST",
        timeout: 15000,
        retry: false,
        data: {
          message: {
            token: delivery.token,
            notification: { title: delivery.title, body: delivery.body },
            data: { notificationId: delivery.notificationId },
            android: { collapse_key: delivery.notificationId },
            apns: { headers: { "apns-collapse-id": delivery.notificationId } },
            webpush: { headers: { Topic: delivery.notificationId.replace(/-/g, "") } }
          }
        }
      });
      return "sent";
    } catch (error) {
      const failure = error as { response?: { data?: { error?: { details?: { errorCode?: string }[] } } } };
      if (failure.response?.data?.error?.details?.some(item => item.errorCode === "UNREGISTERED")) return "invalid";
      throw new Error("Push transport failed");
    }
  }
}
