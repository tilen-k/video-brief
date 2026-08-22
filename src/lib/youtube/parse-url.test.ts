import { describe, expect, it } from "vitest";

import { addVideoInputSchema, parseYoutubeId } from "@/lib/youtube/parse-url";

describe("parseYoutubeId", () => {
  it("parses watch URLs", () => {
    expect(
      parseYoutubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
  });

  it("parses youtu.be short links", () => {
    expect(parseYoutubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("parses shorts and embed paths", () => {
    expect(parseYoutubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
    expect(parseYoutubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
  });

  it("accepts a bare video id", () => {
    expect(parseYoutubeId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("rejects non-YouTube hosts", () => {
    expect(parseYoutubeId("https://vimeo.com/123456")).toBeNull();
  });
});

describe("addVideoInputSchema", () => {
  it("returns youtubeId for valid URLs", () => {
    const result = addVideoInputSchema.safeParse({
      url: "https://youtu.be/dQw4w9WgXcQ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.youtubeId).toBe("dQw4w9WgXcQ");
    }
  });

  it("rejects invalid URLs", () => {
    const result = addVideoInputSchema.safeParse({
      url: "https://example.com/watch?v=nope",
    });
    expect(result.success).toBe(false);
  });
});
