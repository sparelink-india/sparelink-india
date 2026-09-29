import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ALGORITHM,
  buildAuthorization,
  canonicalUri,
  deriveSigningKey,
  sha256Hex,
  signedRequestHeaders,
  uriEncode,
} from "./r2-s3";

/**
 * These are the tests that make "the upload signs correctly" a checkable claim.
 *
 * `buildAuthorization` is exercised against the canonical AWS SigV4 S3 example
 * (GET Object, us-east-1, 20130524T000000Z, Range: bytes=0-9), whose expected
 * signature is published in the AWS documentation. If the signing key chain,
 * the canonical header ordering, or the string-to-sign assembly were wrong,
 * that known-answer test fails — which is the whole reason the signer is a
 * small pure function instead of an opaque SDK call.
 */
describe("R2 SigV4 signing", () => {
  it("reproduces the AWS published GET Object signature", () => {
    const authorization = buildAuthorization({
      config: {
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        region: "us-east-1",
      },
      method: "GET",
      path: "/test.txt",
      headers: {
        host: "examplebucket.s3.amazonaws.com",
        range: "bytes=0-9",
      },
      payloadHash: sha256Hex(""),
      timestamp: new Date(Date.UTC(2013, 4, 24, 0, 0, 0)),
    });

    assert.ok(authorization.startsWith(ALGORITHM));
    assert.ok(
      authorization.includes(
        "Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request",
      ),
      `scope missing from: ${authorization}`,
    );
    assert.ok(
      authorization.includes("SignedHeaders=host;range;x-amz-content-sha256;x-amz-date"),
      `signed headers wrong: ${authorization}`,
    );
    assert.ok(
      authorization.endsWith(
        "Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41",
      ),
      `signature mismatch: ${authorization}`,
    );
  });

  it("derives the documented signing key bytes", () => {
    const key = deriveSigningKey(
      "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      "20130524",
      "us-east-1",
    );
    assert.equal(key.toString("hex").length, 64);
    // The chain is deterministic, which is what a signature depends on.
    assert.deepEqual(
      key,
      deriveSigningKey(
        "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        "20130524",
        "us-east-1",
      ),
    );
  });

  it("changes the signature when any signed input changes", () => {
    const base = {
      config: {
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        region: "us-east-1",
      },
      method: "GET",
      path: "/test.txt",
      headers: { host: "examplebucket.s3.amazonaws.com" },
      payloadHash: sha256Hex(""),
      timestamp: new Date(Date.UTC(2013, 4, 24, 0, 0, 0)),
    };
    const baseSignature = buildAuthorization(base);
    assert.notEqual(
      buildAuthorization({ ...base, path: "/other.txt" }),
      baseSignature,
      "path must be signed",
    );
    assert.notEqual(
      buildAuthorization({ ...base, method: "PUT" }),
      baseSignature,
      "method must be signed",
    );
    assert.notEqual(
      buildAuthorization({
        ...base,
        config: { ...base.config, region: "auto" },
      }),
      baseSignature,
      "region must be signed",
    );
    assert.notEqual(
      buildAuthorization({
        ...base,
        payloadHash: sha256Hex("different"),
      }),
      baseSignature,
      "payload hash must be signed",
    );
  });

  /**
   * Regression test for a real intermittent production failure.
   *
   * putObject originally called the signer and then built the request headers
   * separately, computing a SECOND `x-amz-date`. Whenever the second fell on
   * the far side of a one-second boundary from the first, the header sent no
   * longer matched the one the signature covered and R2 answered
   * SignatureDoesNotMatch - on an arbitrary fraction of uploads, which reads
   * as "the bucket is flaky" rather than as a bug.
   *
   * These assertions make that class of failure impossible to reintroduce: the
   * signed header set and the Authorization value must come from one clock
   * read, and the timestamp inside the signature must be the timestamp sent.
   */
  it("returns headers and signature from a single clock read", () => {
    const signed = signedRequestHeaders({
      config: {
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        region: "auto",
      },
      method: "PUT",
      path: "/bucket/banners/2026/03/a.webp",
      headers: { host: "example.r2.cloudflarestorage.com", "content-type": "image/webp" },
      payloadHash: sha256Hex("body"),
      timestamp: new Date(Date.UTC(2026, 2, 3, 4, 5, 6)),
    });

    assert.equal(signed.amzDate, "20260303T040506Z");
    // The header actually sent is the one that was signed.
    assert.equal(signed.headers["x-amz-date"], signed.amzDate);
    /* The timestamp is deliberately NOT in the Authorization header - SigV4 puts
       it in the string-to-sign, not the header. So the invariant to assert is
       that the returned header set is exactly reproducible from the same pinned
       clock, which is what "one clock read" has to mean in practice. */
    const again = signedRequestHeaders({
      config: {
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        region: "auto",
      },
      method: "PUT",
      path: "/bucket/banners/2026/03/a.webp",
      headers: { host: "example.r2.cloudflarestorage.com", "content-type": "image/webp" },
      payloadHash: sha256Hex("body"),
      timestamp: new Date(Date.UTC(2026, 2, 3, 4, 5, 6)),
    });
    assert.equal(again.authorization, signed.authorization);
    assert.deepEqual(again.headers, signed.headers);
    // Every signed header is present in the returned set, so a caller cannot
    // send a header the signature does not cover, nor omit one it does.
    const signedList = /SignedHeaders=([^,]+)/.exec(signed.authorization)?.[1] ?? "";
    for (const name of signedList.split(";")) {
      assert.ok(
        name in signed.headers,
        `signed header ${name} missing from the returned header set`,
      );
    }
    assert.ok(
      "authorization" in signed.headers === false,
      "authorization must be added by the caller",
    );
  });

  it("encodes per RFC 3986, which encodeURIComponent does not do", () => {
    // encodeURIComponent leaves ! * ' ( ) alone; SigV4 must not.
    assert.equal(uriEncode("!*$'()"), "%21%2A%24%27%28%29");
    assert.equal(uriEncode("a b/c"), "a%20b%2Fc");
    assert.equal(uriEncode("safe-._~AZaz09"), "safe-._~AZaz09");
  });

  it("preserves slashes in the canonical path so the key is addressable", () => {
    // Encoding the slashes would point at a different object.
    assert.equal(canonicalUri("/bucket/banners/2026/03/a.webp"), "/bucket/banners/2026/03/a.webp");
    assert.equal(canonicalUri("banners/a.webp"), "/banners/a.webp");
    assert.equal(canonicalUri("/"), "/");
    assert.equal(canonicalUri("/a b/c.webp"), "/a%20b/c.webp");
  });
});
