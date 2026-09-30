import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import StartCard from "./StartCard";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

beforeEach(() => {
  push.mockClear();
  localStorage.clear();
});
afterEach(cleanup);

function mockFetch(handler: (url: string, init?: RequestInit) => Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) =>
      Promise.resolve(handler(url, init)),
    ),
  );
}
afterEach(() => vi.unstubAllGlobals());

describe("StartCard", () => {
  test("offers a code field, a join action and a create action", () => {
    render(<StartCard />);
    expect(screen.getByLabelText(/code/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /beitreten/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /neu/i })).toBeInTheDocument();
  });

  test("the code field keeps only up to four digits", async () => {
    render(<StartCard />);
    const field = screen.getByLabelText(/code/i) as HTMLInputElement;
    await userEvent.type(field, "12ab3456789");
    expect(field.value).toBe("1234");
  });

  test("joining a known code navigates to the monitor", async () => {
    mockFetch(
      () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    render(<StartCard />);
    await userEvent.type(screen.getByLabelText(/code/i), "1234");
    await userEvent.click(screen.getByRole("button", { name: /beitreten/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/monitor/1234"));
  });

  test("an unknown code shows an inline error and does not navigate", async () => {
    mockFetch(
      () => new Response(JSON.stringify({ error: "x" }), { status: 404 }),
    );
    render(<StartCard />);
    await userEvent.type(screen.getByLabelText(/code/i), "0000");
    await userEvent.click(screen.getByRole("button", { name: /beitreten/i }));
    expect(
      await screen.findByText(/Code unbekannt oder Sitzung abgelaufen\./),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  test("a failed creation shows an error and re-enables the button instead of navigating", async () => {
    mockFetch(() => new Response("nope", { status: 500 }));
    render(<StartCard />);
    const neu = screen.getByRole("button", { name: /neu/i });
    await userEvent.click(neu);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(neu).not.toBeDisabled();
  });

  test("creating a session caches the token and opens the admin view with it in the fragment", async () => {
    mockFetch(
      () =>
        new Response(
          JSON.stringify({ code: "654321", adminToken: "secret-token" }),
          { status: 200 },
        ),
    );
    render(<StartCard />);
    await userEvent.click(screen.getByRole("button", { name: /neu/i }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/admin/654321#secret-token"),
    );
    expect(localStorage.getItem("admin:654321")).toBe("secret-token");
  });

  test("links to the source code, as the AGPL asks of a network service", () => {
    render(<StartCard />);
    expect(screen.getByRole("link", { name: /quellcode/i })).toHaveAttribute(
      "href",
      "https://github.com/jorgenschaefer/ekg-trainer",
    );
  });
});
