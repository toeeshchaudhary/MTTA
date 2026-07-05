# MTTA brand

`MTTA-brand-guidelines.pdf` — the brand book for toeesh.network / MTTA, set in the
signage design system (after Order's WMATA screens) that also drives the site's dark mode.

`guidelines.html` is the source. Rebuild the PDF with:

```sh
chromium --headless=new --no-pdf-header-footer \
  --print-to-pdf=brand/MTTA-brand-guidelines.pdf \
  "file://$PWD/brand/guidelines.html"
```

The design tokens in the HTML (`--field`, `--board`, `--head`, `--hairline`, `--cream`,
`--signal`, `--yl`) mirror the `:root[data-theme="dark"]` variables in `app/globals.css` —
if one changes, change both.
