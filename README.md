# Obsidian Auto Scroll To First Header

## Features

- Automatically scrolls to the position of the first header when you open a note.
- The first header will be aligned at the very top of the editor view.

## Purpose

- If there is content such as YAML front matter above the first header, it will be hidden by default.
- You can easily check the YAML or other content above the header by simply scrolling up.

---

## Release Procedure

1. Update the `version` field in `package.json`
2. Run the following command to execute the release process:

```sh
npm run release -- <new_version> "<release notes>"
# Example: npm run release -- 1.0.3 "Bug fixes and improvements"
```

3. A GitHub release will be automatically created with `main.js`, `manifest.json`, and `styles.css` attached as assets.
