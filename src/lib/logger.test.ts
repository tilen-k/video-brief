import { describe, expect, it } from "vitest";

import { errorFields, llmErrorFields } from "./logger";

describe("errorFields", () => {
  it("formats a cause chain without nested errName keys", () => {
    const root = new Error("outer");
    root.name = "OuterError";
    const mid = new Error("mid");
    mid.name = "MidError";
    const leaf = new Error('Unexpected token \'U\', "User Safety: safe" is not valid JSON');
    leaf.name = "AI_JSONParseError";
    mid.cause = leaf;
    root.cause = mid;

    expect(errorFields(root)).toEqual({
      err: "OuterError: outer",
      cause: "MidError: mid",
      cause2:
        'AI_JSONParseError: Unexpected token \'U\', "User Safety: safe" is not valid JSON',
    });
  });

  it("shortens JSON parse messages that embed Text:", () => {
    const parse = new Error(
      'JSON parsing failed: Text: User Safety: safe.\nError message: SyntaxError: Unexpected token \'U\'',
    );
    parse.name = "AI_JSONParseError";
    const outer = new Error("No object generated");
    outer.name = "AI_NoObjectGeneratedError";
    outer.cause = parse;

    expect(errorFields(outer)).toEqual({
      err: "AI_NoObjectGeneratedError: No object generated",
      cause: "AI_JSONParseError: Unexpected token 'U'",
    });
  });
});

describe("llmErrorFields", () => {
  it("includes completion and finishReason from SDK-shaped errors", () => {
    const parse = new Error(
      'JSON parsing failed: Text: User Safety: safe.\nError message: SyntaxError: Unexpected token \'U\'',
    );
    parse.name = "AI_JSONParseError";

    const noObject = new Error(
      "No object generated: could not parse the response.",
    ) as Error & {
      text: string;
      finishReason: string;
      response: { id: string };
    };
    noObject.name = "AI_NoObjectGeneratedError";
    noObject.cause = parse;
    noObject.text = "User Safety: safe.";
    noObject.finishReason = "stop";
    noObject.response = { id: "gen-123" };

    expect(llmErrorFields(noObject)).toEqual({
      err: "AI_NoObjectGeneratedError: No object generated: could not parse the response.",
      cause: "AI_JSONParseError: Unexpected token 'U'",
      completion: "User Safety: safe.",
      finishReason: "stop",
      responseId: "gen-123",
    });
  });

  it("finds completion on a nested cause", () => {
    const inner = new Error("parse failed") as Error & { text: string };
    inner.name = "AI_NoObjectGeneratedError";
    inner.text = '{"isEducational": true';
    const outer = new Error("Could not classify this video");
    outer.name = "AIProviderError";
    outer.cause = inner;

    expect(llmErrorFields(outer).completion).toBe('{"isEducational": true');
  });
});
