jest.mock("@convex-dev/rate-limiter", () => {
  class MockRateLimiter {
    public limit = jest.fn();
  }

  return {
    __esModule: true,
    RateLimiter: MockRateLimiter,
    MINUTE: 60_000,
    HOUR: 3_600_000,
  };
});

jest.mock("../../convex/_generated/api", () => ({
  __esModule: true,
  components: {
    rateLimiter: {
      lib: {
        rateLimit: jest.fn(),
        checkRateLimit: jest.fn(),
        resetRateLimit: jest.fn(),
      },
    },
  },
}));

import { enforceRateLimit, rateLimiter } from "../../convex/rateLimiter";

describe("rateLimiter helper", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("allows the request when the rate limit is not exceeded", async () => {
    const limitSpy = jest
      .spyOn(rateLimiter, "limit")
      .mockResolvedValue({ ok: true });

    await expect(
      enforceRateLimit({} as never, "reportCreate", "user-123")
    ).resolves.toBeUndefined();

    expect(limitSpy).toHaveBeenCalledWith(
      expect.anything(),
      "reportCreate",
      { key: "user-123" }
    );
  });

  it("throws a ConvexError when the rate limit is exceeded", async () => {
    jest
      .spyOn(rateLimiter, "limit")
      .mockResolvedValue({ ok: false, retryAfter: 42 });

    await expect(
      enforceRateLimit({} as never, "authLogin", "ip-addr")
    ).rejects.toMatchObject({
      data: {
        kind: "RateLimited",
        name: "authLogin",
        retryAfter: 42,
        message: expect.stringContaining("Demasiados intentos"),
      },
    });
  });
});
