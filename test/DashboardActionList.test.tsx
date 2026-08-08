import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardActionList } from "@/components/DashboardActionList";
import { ToastProvider } from "@/components/Toast";
import { api } from "@/lib/client-api";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/client-api", () => ({ api: vi.fn() }));

const action = {
  id: "task-1",
  kind: "task" as const,
  title: "Prepare placards",
  detail: "Due Aug 10",
  href: "/meetings/meeting-1",
  urgency: "soon" as const,
  owner: "You",
  completable: true,
};

describe("DashboardActionList", () => {
  beforeEach(() => vi.clearAllMocks());

  it("removes a completed task after the write succeeds", async () => {
    vi.mocked(api).mockResolvedValue({ ok: true, data: {} });
    render(<ToastProvider><DashboardActionList initial={[action]} /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: /complete prepare placards/i }));
    await waitFor(() => expect(screen.queryByText("Prepare placards")).not.toBeInTheDocument());
    expect(refresh).toHaveBeenCalled();
  });

  it("restores the task when the write fails", async () => {
    vi.mocked(api).mockResolvedValue({ ok: false, error: "Could not save" });
    render(<ToastProvider><DashboardActionList initial={[action]} /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: /complete prepare placards/i }));
    await waitFor(() => expect(screen.getByText("Prepare placards")).toBeInTheDocument());
  });
});
