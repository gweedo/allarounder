const { buildDispatchPayload } = require("../src/Payload");

describe("buildDispatchPayload", () => {
  it("matches the CONTENT-CONTRACT.md §8 shape exactly", () => {
    const payload = buildDispatchPayload("sheet123", "writer@example.com", "2026-08-27T10:00:00.000Z", 14);

    expect(payload).toEqual({
      event_type: "publish_request",
      client_payload: {
        sheet_id: "sheet123",
        triggered_by: "writer@example.com",
        triggered_at: "2026-08-27T10:00:00.000Z",
        row: 14,
      },
    });
  });
});
