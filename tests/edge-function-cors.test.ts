import { describe, expect, it } from "vitest";
import { buildEdgeFunctionCorsHeaders } from "../src/community/edgeFunctionCors";

describe("edge function CORS headers", () => {
  it("allows configured caller origins and requested headers for browser preflight requests", () => {
    expect(buildEdgeFunctionCorsHeaders(
      "https://oldenera.example",
      "authorization,x-client-info,apikey,content-type",
      ["https://oldenera.example"]
    )).toEqual({
      "access-control-allow-origin": "https://oldenera.example",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "authorization,x-client-info,apikey,content-type",
      "access-control-max-age": "86400",
      vary: "Origin, Access-Control-Request-Headers",
    });
  });

  it("blocks unconfigured origins", () => {
    expect(buildEdgeFunctionCorsHeaders(
      "https://attacker.example",
      "authorization,x-client-info,apikey,content-type",
      ["https://oldenera.example"]
    )["access-control-allow-origin"]).toBe("null");
  });

  it("allows Vercel preview origins", () => {
    expect(buildEdgeFunctionCorsHeaders(
      "https://olden-era-maps-git-main-embrisa.vercel.app",
      null,
      []
    )["access-control-allow-origin"]).toBe("https://olden-era-maps-git-main-embrisa.vercel.app");
  });

  it("falls back to a safe default header list when the browser does not send one", () => {
    expect(buildEdgeFunctionCorsHeaders("https://oldenera.example", null, ["https://oldenera.example"])["access-control-allow-headers"])
      .toBe("authorization, x-client-info, apikey, content-type");
  });
});
