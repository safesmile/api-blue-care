import { ConfigService } from "@nestjs/config";
import { GoogleAuth } from "google-auth-library";
import { FcmPushSender } from "../../modules/notifications/infrastructure/fcm-push-sender";
import type { PushDelivery } from "../../modules/notifications/domain/push.repository";
jest.mock("google-auth-library", () => ({ GoogleAuth: jest.fn() }));
describe("FCM push transport", () => {
  const request = jest.fn(),
    delivery = {
      id: "delivery",
      notificationId: "ba50a6d7-3ec5-4fb0-9145-2febbfaf8de8",
      token: "secret-token",
      title: "Title",
      body: "Generic body"
    } as PushDelivery;
  beforeEach(() => {
    jest.clearAllMocks();
    (GoogleAuth as unknown as jest.Mock).mockImplementation(() => ({
      getClient: jest.fn().mockResolvedValue({ request })
    }));
  });
  it("uses ADC, a fixed v1 endpoint and a stable notification identifier", async () => {
    const sender = new FcmPushSender(
      new ConfigService({ PUSH_ENABLED: "true", FIREBASE_PROJECT_ID: "blue-care-test" })
    );
    request.mockResolvedValue({});
    expect(await sender.send(delivery)).toBe("sent");
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://fcm.googleapis.com/v1/projects/blue-care-test/messages:send",
        retry: false,
        data: expect.objectContaining({
          message: expect.objectContaining({ data: { notificationId: delivery.notificationId } })
        })
      })
    );
  });
  it("does not call the network when disabled and sanitizes provider failures", async () => {
    const disabled = new FcmPushSender(new ConfigService());
    await expect(disabled.send(delivery)).rejects.toThrow("disabled");
    expect(request).not.toHaveBeenCalled();
    const sender = new FcmPushSender(
      new ConfigService({ PUSH_ENABLED: "true", FIREBASE_PROJECT_ID: "blue-care-test" })
    );
    request.mockRejectedValueOnce({ response: { data: { error: { details: [{ errorCode: "UNREGISTERED" }] } } } });
    expect(await sender.send(delivery)).toBe("invalid");
    request.mockRejectedValueOnce(new Error(delivery.token));
    await expect(sender.send(delivery)).rejects.toThrow("Push transport failed");
  });
});
