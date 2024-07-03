import { describe, expect, test, vi } from "vitest";
import { _createAWSPayload, _createDataForDevice } from "./analysis";
import { Data, DataCreate } from "@tago-io/sdk/lib/types";

vi.mock("@tago-io/sdk", () => ({
  Resources: {
    devices: {
      sendDeviceData: vi.fn(),
    },
  },
}));

describe("getEstimatedPosition", () => {
  test("should return ip_address payload", () => {
    const ip_address = ["127.0.0.1", "127.0.0.2"];
    const payload = _createAWSPayload("", ip_address, undefined);
    expect(payload.Ip?.IpAddress).toBe("127.0.0.1");
    expect(payload.WiFiAccessPoints).toBeUndefined();
    expect(payload.Gnss).toBeUndefined();
  });

  test("should return wifi_adress payload", () => {
    const wifi_adress = {
      "A0:EC:F9:1E:32:C1": -75,
      "A1:EC:F9:1E:32:C1": -56,
    };
    const payload = _createAWSPayload("", [], wifi_adress);
    expect(payload.WiFiAccessPoints?.[0]?.MacAddress).toBe("A0:EC:F9:1E:32:C1");
    expect(payload.WiFiAccessPoints?.[0]?.Rss).toBe(-75);
    expect(payload.WiFiAccessPoints?.[1]?.MacAddress).toBe("A1:EC:F9:1E:32:C1");
    expect(payload.WiFiAccessPoints?.[1]?.Rss).toBe(-56);
    expect(payload.Gnss).toBeUndefined();
    expect(payload.Ip).toBeUndefined();
  });

  test("should return gnss solver payload", () => {
    const gnss_solver = "A1B2C3D401020304112233445566778899AABBCCDDEEFF001234567890ABCDEF";
    const payload = _createAWSPayload(gnss_solver, [], undefined);
    expect(payload.Gnss?.Payload).toBe("A1B2C3D401020304112233445566778899AABBCCDDEEFF001234567890ABCDEF");
    expect(payload.WiFiAccessPoints).toBeUndefined();
    expect(payload.Ip).toBeUndefined();
  });

  test("should return all payload", () => {
    const wifi_adress = {
      "A0:EC:F9:1E:32:C1": -75,
      "A1:EC:F9:1E:32:C1": -56,
    };
    const ip_address = ["127.0.0.1", "127.0.0.2"];
    const gnss_solver = "A1B2C3D401020304112233445566778899AABBCCDDEEFF001234567890ABCDEF";
    const payload = _createAWSPayload(gnss_solver, ip_address, wifi_adress);
    expect(payload.WiFiAccessPoints?.[0]?.MacAddress).toBe("A0:EC:F9:1E:32:C1");
    expect(payload.WiFiAccessPoints?.[0]?.Rss).toBe(-75);
    expect(payload.WiFiAccessPoints?.[1]?.MacAddress).toBe("A1:EC:F9:1E:32:C1");
    expect(payload.WiFiAccessPoints?.[1]?.Rss).toBe(-56);
    expect(payload.Gnss?.Payload).toBe("A1B2C3D401020304112233445566778899AABBCCDDEEFF001234567890ABCDEF");
    expect(payload.Ip?.IpAddress).toBe("127.0.0.1");
  });

  test("should return only timestamp", () => {
    const payload = _createAWSPayload("", [], undefined);
    expect(payload.Timestamp).toBeInstanceOf(Date);
    expect(payload.WiFiAccessPoints).toBeUndefined();
    expect(payload.Gnss).toBeUndefined();
    expect(payload.Ip).toBeUndefined();
  });

  test("should return the data to send to device", () => {
    const scope: Data = {
      created_at: new Date("2024-07-01T18:06:30.805Z"),
      device: "123abc123",
      group: "abc123abc",
      id: "qwe123qew",
      metadata: { ip_list: ["127.0.0.1"] },
      time: new Date("2024-07-01T18:06:30.805Z"),
      value: "127.0.0.1",
      variable: "ip_address",
    };
    const desireableAccuracy = "10";
    const estimatedLocation = {
      coordinates: [10, 20],
      properties: {
        horizontalConfidenceLevel: 10,
        verticalConfidenceLevel: 12,
      },
    };
    const result: DataCreate = _createDataForDevice(scope, desireableAccuracy, estimatedLocation);
    expect(result.group).toBe(scope.group);
    expect(result.time).toBe(scope.time);
    expect(result.variable).toBe("estimated_location");
    expect(result.value).toBe("accurate");
    expect(result.metadata?.horizontalAccuracy).toBe(10);
    expect(result.metadata?.verticalAccuracy).toBe(12);
    expect(result.metadata?.color).toBe("green");
    expect.objectContaining({ result: { location: { lat: 20, lng: 10 } } });
  });
});
