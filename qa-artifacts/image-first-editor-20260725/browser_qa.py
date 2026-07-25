import json
import struct
import zlib
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import Page, sync_playwright


BASE_URL = "http://127.0.0.1:3000"
ARTIFACTS = Path(__file__).resolve().parent
CHROME_PATH = (
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
)


def solid_png(width: int, height: int) -> bytes:
    raw_rows = b"".join(
        b"\x00" + bytes((85, 103, 210, 255)) * width
        for _ in range(height)
    )

    def chunk(kind: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + kind
            + data
            + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
        )

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(
            b"IHDR",
            struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0),
        )
        + chunk(b"IDAT", zlib.compress(raw_rows))
        + chunk(b"IEND", b"")
    )


TEST_IMAGE = solid_png(640, 400)
TREND = {
    "id": "trend-modi",
    "title": "Narendra Modi viral reel",
    "approximateTraffic": 50000,
    "trafficLabel": "50000+",
    "publishedAt": "2026-07-25T13:00:00.000Z",
    "sources": [],
}
ASSET = {
    "id": "commons-modi",
    "title": "Narendra Modi reaction",
    "previewUrl": "https://upload.wikimedia.org/memehub-qa.png",
    "assetUrl": "https://upload.wikimedia.org/memehub-qa.png",
    "sourceUrl": (
        "https://commons.wikimedia.org/wiki/File:Narendra_Modi_reaction.png"
    ),
    "width": 640,
    "height": 400,
    "mimeType": "image/png",
    "creator": "QA photographer",
    "creditLine": "QA photographer",
    "licenseName": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
    "attributionRequired": True,
    "provider": "Wikimedia Commons",
    "rights": "attribution",
}


def setup_routes(page: Page) -> None:
    def discovery(route) -> None:
        query = parse_qs(urlparse(route.request.url).query).get("q", [""])[0]
        payload = {
            "fetchedAt": "2026-07-25T13:05:00.000Z",
            "query": query,
            "region": "IN",
            "trends": [TREND],
            "reusableImages": [ASSET] if query else [],
            "videos": [],
            "providers": {
                "trends": "live",
                "commons": "live" if query else "idle",
                "youtube": "not-configured",
            },
        }
        route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps(payload),
        )

    page.route("**/api/creator-discovery**", discovery)
    page.route(
        "https://upload.wikimedia.org/memehub-qa.png",
        lambda route: route.fulfill(
            status=200,
            headers={
                "content-length": str(len(TEST_IMAGE)),
                "content-type": "image/png",
            },
            body=TEST_IMAGE,
        ),
    )


def open_first_template(page: Page) -> None:
    page.goto(BASE_URL, wait_until="domcontentloaded", timeout=60_000)
    template = page.locator(
        'button[aria-label^="Use "][aria-label$=" template"]'
    ).first
    template.wait_for(state="visible", timeout=60_000)
    template.click()
    page.get_by_role("button", name="Back").wait_for(
        state="visible", timeout=60_000
    )
    page.locator("canvas").wait_for(state="visible", timeout=60_000)
    page.locator("section[aria-busy='false']").wait_for(
        state="visible", timeout=60_000
    )
    page.get_by_text("Draft saved", exact=True).wait_for(
        state="visible", timeout=60_000
    )
    page.wait_for_timeout(700)


def desktop_flow(page: Page) -> dict:
    open_first_template(page)

    expand = page.get_by_role("button", name="Expand tools")
    assert expand.get_attribute("aria-expanded") == "false"
    assert not page.get_by_role(
        "heading", name="Find a meme image"
    ).is_visible()

    canvas_box = page.locator("canvas").bounding_box()
    tools_box = expand.locator("xpath=ancestor::section[1]").bounding_box()
    textareas = page.locator("textarea")
    assert canvas_box and canvas_box["width"] >= 500
    assert tools_box and tools_box["height"] < 130
    assert textareas.count() >= 1
    assert textareas.first.is_visible()

    page.screenshot(
        path=str(ARTIFACTS / "desktop-compact-editor.png"),
        full_page=True,
    )

    page.get_by_role("tab", name="Images").click()
    page.get_by_role("heading", name="Find a meme image").wait_for(
        state="visible"
    )
    assert page.get_by_text("Source inbox", exact=False).count() == 0
    assert page.get_by_text("Coverage", exact=False).count() == 0
    page.screenshot(
        path=str(ARTIFACTS / "desktop-image-picker.png"),
        full_page=True,
    )

    search = page.get_by_role(
        "searchbox", name="Search viral topics and reusable visuals"
    )
    search.fill("Narendra Modi viral reel")
    search.press("Enter")
    page.get_by_role(
        "heading", name='Images for “Narendra Modi viral reel”'
    ).wait_for(state="visible")
    page.get_by_alt_text("Narendra Modi reaction").wait_for(state="visible")
    page.screenshot(
        path=str(ARTIFACTS / "desktop-image-search-results.png"),
        full_page=True,
    )

    page.get_by_role(
        "button", name="Use Narendra Modi reaction as template"
    ).click()
    page.get_by_role("button", name="Expand tools").wait_for(state="visible")
    page.wait_for_function(
        """() => {
            const canvas = document.querySelector('canvas');
            return canvas?.width === 640 && canvas?.height === 400;
        }"""
    )
    replacement_textareas = page.locator(
        'textarea[aria-label^="text position"]'
    )
    assert replacement_textareas.count() == 2
    assert replacement_textareas.nth(0).is_visible()
    assert replacement_textareas.nth(1).is_visible()
    assert (
        page.get_by_role("tab", name="Text").get_attribute("aria-selected")
        == "true"
    )
    page.wait_for_function(
        """() =>
            document.activeElement?.getAttribute('aria-label') ===
            'text position 1'
        """
    )
    replacement_textareas.nth(0).fill("WHEN THE REEL BECOMES THE TEMPLATE")
    page.wait_for_timeout(100)
    page.get_by_text("Draft saved", exact=True).wait_for(
        state="visible", timeout=60_000
    )
    page.wait_for_timeout(700)

    page.screenshot(
        path=str(ARTIFACTS / "desktop-start-from-image.png"),
        full_page=True,
    )
    page.get_by_role("tab", name="Layers").click()
    layers_panel = page.get_by_role("tabpanel", name="Layers")
    layers_panel.get_by_text(
        "CC BY 4.0", exact=True
    ).wait_for(state="visible")
    layers_panel.get_by_role(
        "link", name="Open background image source"
    ).wait_for(state="visible")
    page.wait_for_timeout(250)
    page.screenshot(
        path=str(ARTIFACTS / "desktop-base-image-layer.png"),
        full_page=True,
    )

    return {
        "canvas": canvas_box,
        "compactTools": tools_box,
        "replacementCanvas": {"width": 640, "height": 400},
        "replacementTextFields": replacement_textareas.count(),
    }


def mobile_flow(page: Page) -> dict:
    open_first_template(page)
    canvas_box = page.locator("canvas").bounding_box()
    expand = page.get_by_role("button", name="Expand tools")
    tools_box = expand.locator("xpath=ancestor::section[1]").bounding_box()
    textareas = page.locator("textarea")

    assert canvas_box and canvas_box["width"] <= 390
    assert tools_box and tools_box["height"] < 130
    assert textareas.count() >= 1
    assert textareas.first.is_visible()

    page.screenshot(
        path=str(ARTIFACTS / "mobile-compact-editor.png"),
        full_page=True,
    )
    page.get_by_role("tab", name="Images").click()
    page.get_by_role("heading", name="Find a meme image").wait_for(
        state="visible"
    )
    page.screenshot(
        path=str(ARTIFACTS / "mobile-image-picker.png"),
        full_page=True,
    )
    search = page.get_by_role(
        "searchbox", name="Search viral topics and reusable visuals"
    )
    search.fill("Narendra Modi viral reel")
    search.press("Enter")
    result_image = page.get_by_alt_text("Narendra Modi reaction")
    result_image.wait_for(state="visible")
    result_card_box = result_image.locator(
        "xpath=ancestor::article[1]"
    ).bounding_box()
    assert result_card_box and result_card_box["width"] >= 300
    page.screenshot(
        path=str(ARTIFACTS / "mobile-image-search-results.png"),
        full_page=True,
    )

    return {
        "canvas": canvas_box,
        "compactTools": tools_box,
        "textFields": textareas.count(),
        "resultCard": result_card_box,
    }


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        executable_path=CHROME_PATH,
        headless=True,
    )
    desktop_context = browser.new_context(
        viewport={"width": 1440, "height": 1000}
    )
    desktop_page = desktop_context.new_page()
    setup_routes(desktop_page)
    desktop_errors = []
    desktop_page.on("pageerror", lambda error: desktop_errors.append(str(error)))
    desktop_result = desktop_flow(desktop_page)
    assert desktop_errors == [], desktop_errors
    desktop_context.close()

    mobile_context = browser.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=1,
        is_mobile=True,
        has_touch=True,
    )
    mobile_page = mobile_context.new_page()
    setup_routes(mobile_page)
    mobile_errors = []
    mobile_page.on("pageerror", lambda error: mobile_errors.append(str(error)))
    mobile_result = mobile_flow(mobile_page)
    assert mobile_errors == [], mobile_errors
    mobile_context.close()
    browser.close()

    report = {
        "desktop": desktop_result,
        "mobile": mobile_result,
        "pageErrors": [],
    }
    (ARTIFACTS / "browser-qa.json").write_text(
        json.dumps(report, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(report, indent=2))
