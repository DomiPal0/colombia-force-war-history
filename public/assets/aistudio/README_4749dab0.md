# Colombia Force — DomiStats War Archive

A small static dashboard containing the saved COLOMBIA FORCE war history. It currently starts with 250 wars. The collector reads only DomiStats page 1, refreshes matching entries found there, and carries forward the saved older entries without requesting their pages.

## Scheduled refresh

The included GitHub Actions workflow:

- Runs daily at 07:17 Colombia time (12:17 UTC) and can also be started manually.
- Reads only page 1 from DomiStats and stops without replacing the saved snapshot if the page cannot be read.
- Replaces matching recent entries using their date and alliance names; previously saved entries not present on page 1 are carried forward unchanged.
- Adds new unique wars to the saved history, keeping older records instead of trimming the archive.
- Updates `data/wars.json` and `index.html` in the repository.
- Has GitHub Pages deployment disabled by default. The workflow only deploys if the repository variable `ENABLE_PAGES` is set to `true`.

GitHub may delay scheduled workflows during busy periods, so the refresh is not guaranteed at an exact minute.

## Set it up in GitHub

1. Create a **private repository** for this folder. Keep the repository private while checking the Pages access options.
2. Push the contents of this folder to the repository's default branch.
3. In repository settings, allow GitHub Actions to write to the repository so the workflow can commit updated snapshots.
4. Run **Actions → Refresh Colombia Force war archive → Run workflow** once to check that the collector can read DomiStats.
5. Only enable the optional Pages deployment after confirming the published site can be restricted to alliance members. Set repository variable `ENABLE_PAGES=true`, and configure Pages visibility as **Private** where the account or organization plan supports it.

GitHub currently limits privately published GitHub Pages sites to organizations on GitHub Enterprise Cloud. A private repository alone does not make its Pages site private. If that option is unavailable, do not enable Pages; use a host with access control in front of the site instead.

## Local preview

The current `index.html` is a self-contained snapshot and can be opened directly. To regenerate it from the saved JSON without fetching DomiStats, install the packages from `requirements.txt` and run:

```sh
python scripts/update_wars.py --from-cache
```

To refresh from DomiStats on a local machine, run:

```sh
python scripts/update_wars.py
```

