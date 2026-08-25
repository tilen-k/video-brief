import { describe, expect, it } from "vitest";

import { parseYoutubeId } from "@/lib/youtube/parse-url";

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
