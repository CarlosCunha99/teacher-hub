import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const flushPromises = async () => {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
};

const createJsonResponse = <T,>(body: T, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: vi.fn().mockResolvedValue(body),
});

const toArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value == null ? [] : [value];

const collectText = (node: unknown): string => {
  if (node == null || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(collectText).join("");
  }
  if (typeof node === "object" && "props" in node) {
    return collectText((node as { props: { children?: unknown } }).props.children);
  }
  return "";
};

const findElement = (
  node: unknown,
  predicate: (element: { type: unknown; props: Record<string, unknown> }) => boolean
): { type: unknown; props: Record<string, unknown> } | null => {
  if (node == null || typeof node === "boolean") {
    return null;
  }

  if (Array.isArray(node)) {
    for (const child of node) {
      const match = findElement(child, predicate);
      if (match) {
        return match;
      }
    }
    return null;
  }

  if (typeof node === "object" && "type" in node && "props" in node) {
    const element = node as { type: unknown; props: Record<string, unknown> };
    if (predicate(element)) {
      return element;
    }

    for (const child of toArray(element.props.children)) {
      const match = findElement(child, predicate);
      if (match) {
        return match;
      }
    }
  }

  return null;
};

const findButtonByText = (node: unknown, text: string) =>
  findElement(
    node,
    (element) => element.type === "button" && collectText(element.props.children).includes(text)
  );

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const setupComponent = async () => {
  vi.resetModules();

  const hookState: {
    values: unknown[];
    cursor: number;
    effect: null | (() => void | (() => void));
  } = {
    values: [],
    cursor: 0,
    effect: null,
  };

  const useState = vi.fn((initialValue: unknown) => {
    const index = hookState.cursor++;
    if (!(index in hookState.values)) {
      hookState.values[index] = initialValue;
    }

    const setState = (value: unknown | ((previous: unknown) => unknown)) => {
      hookState.values[index] =
        typeof value === "function"
          ? (value as (previous: unknown) => unknown)(hookState.values[index])
          : value;
    };

    return [hookState.values[index], setState] as const;
  });

  const useEffect = vi.fn((effect: () => void | (() => void)) => {
    hookState.effect = effect;
  });

  vi.doMock("react", async () => {
    const actual = await vi.importActual<typeof import("react")>("react");
    return {
      ...actual,
      useEffect,
      useState,
    };
  });

  const { default: SettingsPage } = await import("../page");

  const render = () => {
    hookState.cursor = 0;
    return SettingsPage();
  };

  return {
    hookState,
    render,
    runEffect: () => hookState.effect?.(),
  };
};

describe("SettingsPage", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: {
          href: "http://localhost/settings",
        },
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unmock("react");
    delete (globalThis as { fetch?: typeof fetch }).fetch;
    delete (globalThis as { window?: Window & typeof globalThis }).window;
  });

  it("fetches subscription data on mount and keeps the loading state while the request is in flight", async () => {
    const pendingFetch = createDeferred<ReturnType<typeof createJsonResponse>>();
    globalThis.fetch = vi.fn().mockReturnValue(pendingFetch.promise) as typeof fetch;

    const { render, runEffect } = await setupComponent();

    const initialTree = render();
    expect(collectText(initialTree)).toContain("Loading your subscription");

    runEffect();

    expect(globalThis.fetch).toHaveBeenCalledWith("/api/billing/subscription");

    const loadingTree = render();
    expect(collectText(loadingTree)).toContain("Loading your subscription");
  });

  it("renders the upgrade action for free users and redirects to checkout", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse({
          status: "none",
          currentPeriodEnd: null,
          priceId: null,
          isPremium: false,
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({ url: "https://checkout.stripe.test/session" })
      ) as typeof fetch;

    const { render, runEffect } = await setupComponent();

    render();
    runEffect();
    await flushPromises();

    const tree = render();
    const upgradeButton = findButtonByText(tree, "Upgrade to premium");

    expect(upgradeButton).not.toBeNull();
    expect(findButtonByText(tree, "Manage subscription")).toBeNull();

    await (upgradeButton?.props.onClick as () => Promise<void>)();
    await flushPromises();

    expect(globalThis.fetch).toHaveBeenNthCalledWith(2, "/api/billing/checkout", {
      method: "POST",
    });
    expect(window.location.href).toBe("https://checkout.stripe.test/session");
  });

  it("renders premium status details and redirects to the billing portal", async () => {
    const currentPeriodEnd = "2026-09-27T12:00:00.000Z";

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse({
          status: "active",
          currentPeriodEnd,
          priceId: "price_123",
          isPremium: true,
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({ url: "https://billing.stripe.test/portal" })
      ) as typeof fetch;

    const { render, runEffect } = await setupComponent();

    render();
    runEffect();
    await flushPromises();

    const tree = render();
    const treeText = collectText(tree);
    const manageButton = findButtonByText(tree, "Manage subscription");

    expect(treeText).toContain("Plan status:");
    expect(treeText).toContain("active");
    expect(treeText).toContain(new Date(currentPeriodEnd).toLocaleDateString());
    expect(manageButton).not.toBeNull();
    expect(findButtonByText(tree, "Upgrade to premium")).toBeNull();

    await (manageButton?.props.onClick as () => Promise<void>)();
    await flushPromises();

    expect(globalThis.fetch).toHaveBeenNthCalledWith(2, "/api/billing/portal", { method: "POST" });
    expect(window.location.href).toBe("https://billing.stripe.test/portal");
  });

  it("shows an actionable error when the subscription fetch rejects without exposing raw details", async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new Error("low-level network failure")) as typeof fetch;

    const { render, runEffect } = await setupComponent();

    render();
    runEffect();
    await flushPromises();

    expect(() => render()).not.toThrow();

    const tree = render();
    const treeText = collectText(tree);
    const alert = findElement(tree, (element) => element.props.role === "alert");

    expect(alert).not.toBeNull();
    expect(treeText).toContain(
      "We couldn't load your subscription details. Please refresh to try again."
    );
    expect(treeText).not.toContain("low-level network failure");
  });

  it("shows an actionable error when the subscription fetch returns a non-2xx response", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(createJsonResponse({ error: "boom" }, 500)) as typeof fetch;

    const { render, runEffect } = await setupComponent();

    render();
    runEffect();
    await flushPromises();

    const tree = render();
    const treeText = collectText(tree);
    const alert = findElement(tree, (element) => element.props.role === "alert");

    expect(alert).not.toBeNull();
    expect(treeText).toContain(
      "We couldn't load your subscription details. Please refresh to try again."
    );
    expect(treeText).not.toContain("Request failed with status 500");
  });
});
