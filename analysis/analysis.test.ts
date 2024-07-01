import { describe, expect, test } from 'vitest'
import { getEstimatedDeviceLocation } from './analysis'

describe("", () => {
    test("analysis", () => {
        expect(getEstimatedDeviceLocation()).toBe(true)
    });
});