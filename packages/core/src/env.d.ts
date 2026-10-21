/**
 * Private compiler input for the publisher's standard NODE_ENV guards.
 * This file is not emitted into the public declarations. Native browser builds
 * replace every guard; no Node globals or process shim ship with either one.
 */
declare const process: { env: { NODE_ENV?: string } };
