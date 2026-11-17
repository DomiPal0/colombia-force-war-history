from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
URL = "https://domistats.com/alliance_wars/68105"
ALLIANCE_URL = "https://domistats.com/alliance/68105"
SOURCE_PAGE_COUNT = 1
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
}


def text(node, selector: str, default: str = "—") -> str:
    found = node.select_one(selector)
    return found.get_text(" ", strip=True) if found else default


def normalize_rank(raw: str) -> str:
    value = (raw or "").strip()
    if not value or value == "—":
        return "—"
    match = re.match(r"^#\s*(\d+)$", value)
    return f"#{match.group(1)}" if match else value


def read_side(war, side_name: str) -> dict:
    side = war.select_one(f".war-opponent-{side_name}")
    if side is None:
        raise ValueError(f"Missing war-opponent-{side_name}")
    division = side.select_one(".division-rank")
    return {
        "name": text(side, ".war-alliance-name"),
        "rank": normalize_rank(text(side, ".war-crest-rank")),
        "glory": text(side, ".war-alliance-glory span"),
        "division": " ".join(span.get_text(" ", strip=True) for span in division.find_all("span", recursive=False)) if division else "—",
    }


def read_war(war, page: int) -> dict:
    left = read_side(war, "left")
    right = read_side(war, "right")
    if "COLOMBIA FORCE" not in (left["name"], right["name"]):
        raise ValueError("A war entry did not include COLOMBIA FORCE")

    def read_star_text(node) -> str:
        if not node:
            return "—"
        value = node.get_text(" ", strip=True)
        return value if value else "—"

    stars = war.select(".war-stars")
    left_star_node = war.select_one(".war-stars.war-stars-left.no-wrap, .war-stars.war-stars-left") or (
        stars[0] if stars else None
    )
    right_star_node = war.select_one(
        ".war-stars.no-wrap:not(.war-stars-left), .war-stars:not(.war-stars-left)"
    ) or (stars[1] if len(stars) > 1 else None)
    left_stars = read_star_text(left_star_node)
    right_stars = read_star_text(right_star_node)
    result_node = war.select_one(".war-glory-winner, .war-glory-loser")
    result = result_node.get_text(" ", strip=True) if result_node else "—"

    if left["name"] != "COLOMBIA FORCE":
        left, right = right, left
        left_stars, right_stars = right_stars, left_stars
        if result != "—":
            result_number = int(result.replace(",", ""))
            result = str(-result_number)

    tags = war.select(".war-glory-center .war-tag")
    notes = [
        tag.get_text(" ", strip=True)
        for tag in tags
        if "war-tag-close" in tag.get("class", []) or "war-tag-time" in tag.get("class", [])
    ]
    rel_time = war.select_one(".war-rel-time")
    title = (war.get("data-share-title") or f"{left['name']} vs {right['name']}").strip()
    return {
        "page": page,
        "title": title,
        "date": rel_time.get("data-tooltip", "") if rel_time else "",
        "left": left,
        "right": right,
        "result": result,
        "stars": [left_stars, right_stars],
        "size": text(war, ".war-tag-size"),
        "notes": ", ".join(notes) if notes else "—",
    }


def fetch_wars() -> list[dict]:
    import requests
    from bs4 import BeautifulSoup

    session = requests.Session()
    session.headers.update(HEADERS)
    collected: list[dict] = []
    for page in range(1, SOURCE_PAGE_COUNT + 1):
        response = session.get(URL, params={"page": page}, timeout=45)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")
        container = soup.select_one(".wars-container")
        entries = container.select(".war") if container else []
        if not entries:
            raise RuntimeError(
                f"No war entries found on page {page}; preserving the existing snapshot."
            )
        page_wars = [read_war(war, page) for war in entries]
        if page == 1 and page_wars:
            latest = page_wars[0]
            print(
                f"Page 1 latest war: {latest['title']} | date={latest['date']} | "
                f"stars={latest['stars']} | size={latest['size']} | "
                f"cf-cache={response.headers.get('cf-cache-status', 'n/a')}"
            )
        collected.extend(page_wars)

    if not collected:
        raise RuntimeError(
            "No wars were read; preserving the existing snapshot."
        )
    return collected


def parse_alliance_info(html: str) -> dict:
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")

    glory = "—"
    for candidate in soup.select(
        '[data-tooltip="Glory"] .glory-value, .alliance-info-subcontainer .glory-row .glory-value, .glory-row .glory-value, .glory-value'
    ):
        next_span = candidate.select_one('img[alt="Glory"] + span')
        val = (
            next_span.get_text(" ", strip=True)
            if next_span
            else candidate.get_text(" ", strip=True)
        ).strip()
        if re.search(r"\d", val):
            glory = val
            break
    if glory == "—":
        for glory_img in soup.select('img[alt="Glory"]'):
            next_span = glory_img.find_next_sibling("span")
            if next_span:
                val = next_span.get_text(" ", strip=True).strip()
                if re.search(r"\d", val):
                    glory = val
                    break

    rank = "—"
    rank_node = soup.select_one(
        '.alliance-info-subcontainer .rank-box-with-diff .rank-box, [data-tooltip="Ranking"] .rank-box, .rank-box-with-diff .rank-box, .rank-box'
    )
    if rank_node:
        raw_rank = re.sub(r"\s+", "", rank_node.get_text("", strip=True))
        if raw_rank:
            rank = normalize_rank(raw_rank if raw_rank.startswith("#") else f"#{raw_rank}")

    division = "—"
    division_node = soup.select_one(".alliance-info-subcontainer .division-rank, .division-rank")
    if division_node:
        spans = [
            span.get_text(" ", strip=True)
            for span in division_node.find_all("span", recursive=False)
            if span.get_text(" ", strip=True)
        ]
        division = " ".join(spans) if spans else (division_node.get_text(" ", strip=True) or "—")

    if glory == "—" and rank == "—" and division == "—":
        raise RuntimeError("Could not parse alliance overview fields from DomiStats.")

    return {
        "glory": glory,
        "rank": rank,
        "division": division,
    }


def fetch_alliance_info() -> dict:
    import requests

    session = requests.Session()
    session.headers.update(HEADERS)
    response = session.get(ALLIANCE_URL, timeout=45)
    response.raise_for_status()
    return parse_alliance_info(response.text)


def war_key(war: dict) -> tuple[str, str, str]:
    return (
        war.get("date", "").strip(),
        war.get("left", {}).get("name", "").strip().upper(),
        war.get("right", {}).get("name", "").strip().upper(),
    )


def merge_history(recent_wars: list[dict], saved_wars: list[dict]) -> list[dict]:
    """Refresh page 1 while retaining saved values absent from the source page."""
    saved_by_key = {war_key(war): war for war in saved_wars}
    merged: list[dict] = []
    known_keys: set[tuple[str, str, str]] = set()

    def missing(value: object) -> bool:
        return value is None or value == "" or value == "—"

    for new_war in recent_wars:
        key = war_key(new_war)
        if key in known_keys:
            continue
        old_war = saved_by_key.get(key)
        if old_war:
            old_stars = old_war.get("stars", ["—", "—"])
            new_stars = new_war.get("stars", ["—", "—"])
            for index in range(2):
                if index >= len(new_stars) or missing(new_stars[index]):
                    if index < len(old_stars):
                        if index >= len(new_stars):
                            new_stars.append(old_stars[index])
                        else:
                            new_stars[index] = old_stars[index]
            new_war["stars"] = new_stars

            for field in ("size", "notes"):
                if missing(new_war.get(field)) and not missing(old_war.get(field)):
                    new_war[field] = old_war[field]

        merged.append(new_war)
        known_keys.add(key)

    for old_war in saved_wars:
        key = war_key(old_war)
        if key not in known_keys:
            merged.append(old_war)
            known_keys.add(key)

    merged.sort(key=lambda item: item.get("date", ""), reverse=True)
    return merged


def write_snapshot(wars: list[dict], updated_at: str, alliance_info: dict | None = None) -> None:
    data: dict = {"updated_at": updated_at, "refresh_pages": SOURCE_PAGE_COUNT}
    if alliance_info:
        data["alliance"] = alliance_info
    data["wars"] = wars
    data_dir = ROOT / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    (data_dir / "wars.json").write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Refresh the Colombia Force war archive.")
    parser.add_argument(
        "--from-cache",
        action="store_true",
        help="Validate and normalize data/wars.json without contacting DomiStats.",
    )
    args = parser.parse_args()

    existing = json.loads((ROOT / "data" / "wars.json").read_text(encoding="utf-8"))
    alliance_info = existing.get("alliance")
    if args.from_cache:
        wars = merge_history([], existing["wars"])
        updated_at = existing["updated_at"]
    else:
        recent_wars = fetch_wars()
        wars = merge_history(recent_wars, existing["wars"])
        try:
            fetched_alliance = fetch_alliance_info()
            if alliance_info:
                alliance_info = {
                    "glory": fetched_alliance["glory"] if fetched_alliance.get("glory") not in (None, "", "—") else alliance_info.get("glory", "—"),
                    "rank": fetched_alliance["rank"] if fetched_alliance.get("rank") not in (None, "", "—") else alliance_info.get("rank", "—"),
                    "division": fetched_alliance["division"] if fetched_alliance.get("division") not in (None, "", "—") else alliance_info.get("division", "—"),
                }
            else:
                alliance_info = fetched_alliance
        except Exception as exc:
            print(f"Warning: could not refresh alliance overview from {ALLIANCE_URL}: {exc}")
        updated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    write_snapshot(wars, updated_at, alliance_info)
    print(f"Updated data/wars.json with {len(wars)} wars; timestamp: {updated_at}")


if __name__ == "__main__":
    main()
