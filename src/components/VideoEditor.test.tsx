// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import VideoEditor from "./VideoEditor";

const { downloadBlob, recordVideo, renderFrame } = vi.hoisted(() => ({
  downloadBlob: vi.fn(),
  recordVideo: vi.fn(),
  renderFrame: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));
vi.mock("@/lib/video/export", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/video/export")>();
  return {
    ...actual,
    recordVideoProject: recordVideo,
    renderVideoProjectFrame: renderFrame,
  };
});
vi.mock("@/lib/canvasExport", () => ({ downloadBlob }));

afterEach(() => {
  cleanup();
  downloadBlob.mockReset();
  recordVideo.mockReset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("VideoEditor", () => {
  it("uses a compact, guttered desktop workspace that fits the preview and both sidebars", () => {
    const styles = readFileSync(
      resolve(process.cwd(), "src/app/globals.css"),
      "utf8",
    );

    expect(styles).toContain("grid-template-columns:342px minmax(0,1fr) 438px");
    expect(styles).toContain("gap:24px;padding:24px clamp(16px,2vw,32px)");
    expect(styles).toContain("width:min(100%,720px)");
    expect(styles).toContain("height:clamp(360px,82vh,1000px)");
    expect(styles).toContain(
      ".video-editor-player { align-self:stretch;height:65px",
    );
  });

  it("renders the full desktop editor workspace before a video is chosen", () => {
    render(<VideoEditor />);

    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Editor tools" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Filters" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Rio de Janeiro" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Edit text" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Position" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Upload video/ }),
    ).toBeInTheDocument();
  });

  it("primes and draws the first frame before playback, then redraws for edits and playback", async () => {
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(
      (tagName, options) => {
        const element = originalCreateElement(tagName, options);
        if (tagName === "video") {
          Object.defineProperties(element, {
            duration: { value: 12 },
            videoWidth: { value: 720 },
            videoHeight: { value: 1280 },
          });
          Object.defineProperty(element, "src", {
            set: () =>
              setTimeout(() =>
                element.onloadedmetadata?.(new Event("loadedmetadata")),
              ),
          });
        }
        return element;
      },
    );
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:video"),
      revokeObjectURL: vi.fn(),
    });
    Object.defineProperty(HTMLMediaElement.prototype, "readyState", {
      configurable: true,
      get: () => HTMLMediaElement.HAVE_CURRENT_DATA,
    });
    render(<VideoEditor />);
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File(["video"], "clip.mp4", { type: "video/mp4" })],
      },
    });
    await waitFor(() =>
      expect(screen.getByLabelText("Text content")).toBeEnabled(),
    );
    expect(screen.getByLabelText("Video preview").parentElement).toHaveStyle({
      aspectRatio: "720 / 1280",
    });
    const video = document.querySelector("video")!;
    renderFrame.mockClear();
    fireEvent.loadedMetadata(video);
    expect(video.currentTime).toBe(0.001);
    fireEvent.seeked(video);
    expect(renderFrame).toHaveBeenCalled();

    fireEvent.loadedData(video);
    renderFrame.mockClear();
    fireEvent.change(screen.getByLabelText("Text content"), {
      target: { value: "Updated caption" },
    });
    await waitFor(() => expect(renderFrame).toHaveBeenCalled());
    renderFrame.mockClear();
    fireEvent.play(video);
    await waitFor(() => expect(renderFrame).toHaveBeenCalled());
  });

  it("wires text formatting, deletion, export, and the image-editor preset list to the selected layer", async () => {
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(
      (tagName, options) => {
        const element = originalCreateElement(tagName, options);
        if (tagName === "video") {
          Object.defineProperties(element, {
            duration: { value: 12 },
            videoWidth: { value: 720 },
            videoHeight: { value: 1280 },
          });
          Object.defineProperty(element, "src", {
            set: () =>
              setTimeout(() =>
                element.onloadedmetadata?.(new Event("loadedmetadata")),
              ),
          });
        }
        return element;
      },
    );
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:video"),
      revokeObjectURL: vi.fn(),
    });
    Object.defineProperty(HTMLMediaElement.prototype, "readyState", {
      configurable: true,
      get: () => HTMLMediaElement.HAVE_CURRENT_DATA,
    });
    render(<VideoEditor />);
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: {
        files: [new File(["video"], "clip.mp4", { type: "video/mp4" })],
      },
    });
    await waitFor(() =>
      expect(screen.getByLabelText("Text content")).toBeEnabled(),
    );

    expect(screen.getByRole("button", { name: "Black Bar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Meme Outline" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reaction" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cinema caption" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Meme classic" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pop caption" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Neon reaction" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View all presets" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reaction" }));
    expect(screen.getByLabelText("Text color")).toHaveValue("#ffd400");
    expect(screen.getByLabelText("Outline width")).toHaveValue("5");
    expect(screen.getByLabelText("Shadow blur")).toHaveValue("6");

    fireEvent.click(screen.getByRole("button", { name: "Align left" }));
    expect(screen.getByRole("button", { name: "Align left" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Lowercase text" }));
    expect(
      screen.getByRole("button", { name: "Lowercase text" }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Toggle outline" }));
    expect(
      screen.getByRole("button", { name: "Toggle outline" }),
    ).toHaveAttribute("aria-pressed", "false");

    expect(screen.queryByRole("button", { name: "Duplicate text" })).not.toBeInTheDocument();
    const deleteButton = screen.getByRole("button", { name: "Delete text" });
    const exportButton = screen.getByRole("button", { name: "Export video" });
    expect(deleteButton.nextElementSibling).toBe(exportButton);

    const capture = new Blob(["mp4"], { type: "video/mp4" });
    recordVideo.mockResolvedValue(capture);
    fireEvent.click(exportButton);
    await waitFor(() =>
      expect(downloadBlob).toHaveBeenCalledWith(capture, "memehub-video.mp4"),
    );

    fireEvent.click(deleteButton);
    expect(
      screen.queryByRole("button", { name: "Move text box" }),
    ).not.toBeInTheDocument();
  });

  it("shows transform controls for the selected text box and removes it with the Delete key", async () => {
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(
      (tagName, options) => {
        const element = originalCreateElement(tagName, options);
        if (tagName === "video") {
          Object.defineProperties(element, {
            duration: { value: 12 },
            videoWidth: { value: 720 },
            videoHeight: { value: 1280 },
          });
          Object.defineProperty(element, "src", {
            set: () =>
              setTimeout(() =>
                element.onloadedmetadata?.(new Event("loadedmetadata")),
              ),
          });
        }
        return element;
      },
    );
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:video"),
      revokeObjectURL: vi.fn(),
    });
    render(<VideoEditor />);
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: {
        files: [new File(["video"], "clip.mp4", { type: "video/mp4" })],
      },
    });
    await waitFor(() =>
      expect(screen.getByLabelText("Text content")).toBeEnabled(),
    );

    expect(
      screen.getByRole("button", { name: "Resize text box" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Rotate text box" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Font size")).toBeEnabled();

    fireEvent.keyDown(window, { key: "Delete" });
    expect(
      screen.queryByRole("button", { name: "Move text box" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Text content")).toBeDisabled();
  });

  it("opens the edited preview in fullscreen and removes the transform tip", async () => {
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName, options) => {
      const element = originalCreateElement(tagName, options);
      if (tagName === "video") {
        Object.defineProperties(element, {
          duration: { value: 12 },
          videoWidth: { value: 720 },
          videoHeight: { value: 1280 },
        });
        Object.defineProperty(element, "src", {
          set: () => setTimeout(() => element.onloadedmetadata?.(new Event("loadedmetadata"))),
        });
      }
      return element;
    });
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    const exitFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", { configurable: true, value: requestFullscreen });
    Object.defineProperty(document, "exitFullscreen", { configurable: true, value: exitFullscreen });
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:video"), revokeObjectURL: vi.fn() });
    render(<VideoEditor />);
    expect(screen.getByRole("button", { name: "Enter fullscreen" })).toBeDisabled();
    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [new File(["video"], "clip.mp4", { type: "video/mp4" })] } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Enter fullscreen" })).toBeEnabled());

    fireEvent.click(screen.getByRole("button", { name: "Enter fullscreen" }));
    expect(requestFullscreen).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", { name: "Exit fullscreen" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Exit fullscreen" }));
    expect(exitFullscreen).toHaveBeenCalled();
    expect(screen.queryByText(/Tip: Select a text box/i)).not.toBeInTheDocument();
  });
});
