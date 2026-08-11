import { describe, it, expect } from "vitest";
// Server-side capture grammar (functions/classify.js) — the source of truth for
// how inbound WhatsApp messages are routed to tasks vs the shopping list.
import { classifyMessage, senderKey } from "../../functions/classify.js";

describe("classifyMessage", () => {
  it("routes buy/purchase/pick up/grab to shopping", () => {
    expect(classifyMessage("buy milk")).toMatchObject({ kind: "shop", text: "milk" });
    expect(classifyMessage("purchase: eggs")).toMatchObject({ kind: "shop", text: "eggs" });
    expect(classifyMessage("pick up bread")).toMatchObject({ kind: "shop", text: "bread" });
    expect(classifyMessage("grab batteries")).toMatchObject({ kind: "shop", text: "batteries" });
  });
  it("routes add/task/remind to a task", () => {
    expect(classifyMessage("add call the plumber")).toMatchObject({ kind: "task", text: "call the plumber" });
    expect(classifyMessage("remind me to renew the licence")).toMatchObject({ kind: "task", text: "renew the licence" });
    expect(classifyMessage("todo: fix gate light")).toMatchObject({ kind: "task", text: "fix gate light" });
  });
  it("routes chore to a chore", () => {
    expect(classifyMessage("chore take out the bins")).toMatchObject({ kind: "chore", text: "take out the bins" });
  });
  it("ignores bare keywords with no text", () => {
    expect(classifyMessage("add")).toMatchObject({ kind: null });
    expect(classifyMessage("buy")).toMatchObject({ kind: null });
  });
  it("ignores unrelated messages", () => {
    expect(classifyMessage("is the alarm armed?")).toMatchObject({ kind: null });
    expect(classifyMessage("status")).toMatchObject({ kind: null });
  });
  it("prefers shopping over task when both could match order", () => {
    // "buy" is a shopping verb; must not be mis-read as a task.
    expect(classifyMessage("buy dog food").kind).toBe("shop");
  });
});

describe("senderKey", () => {
  it("maps Mandri's number", () => expect(senderKey("+27 82 731 659 285")).toBe("mandri"));
  it("defaults to christo", () => expect(senderKey("27725667675")).toBe("christo"));
  it("defaults to christo for empty", () => expect(senderKey("")).toBe("christo"));
});
