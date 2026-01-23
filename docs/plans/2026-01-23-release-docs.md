# Release Docs Update and Patch Release Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update README and CHANGELOG to describe the new streaming output and faster loading, then release a patch version.

**Architecture:** Keep changes limited to documentation, version bumps, packaging, and release metadata. Reuse existing release workflow in `.cursorrules` to generate the ZIP and publish the GitHub release.

**Tech Stack:** Chrome MV3 extension, Markdown docs, GitHub CLI release.

### Task 1: Inspect current docs and release conventions

**Files:**
- Read: `README.md`
- Read: `CHANGELOG.md`
- Read: `manifest.json`
- Read: `package.json`

**Step 1: Read README sections for features/usage**

**Step 2: Read CHANGELOG format and latest entry**

**Step 3: Identify current version in manifest/package**

### Task 2: Update README with new feature highlight

**Files:**
- Modify: `README.md`

**Step 1: Add a short feature note describing native streaming output**

**Step 2: Add performance note emphasizing faster load/first response**

### Task 3: Update CHANGELOG with new release entry

**Files:**
- Modify: `CHANGELOG.md`

**Step 1: Add a new version section (patch bump)**

**Step 2: Document streaming output and SSE fallback**

**Step 3: Emphasize improved perceived load speed**

### Task 4: Bump version numbers

**Files:**
- Modify: `manifest.json`
- Modify: `package.json`

**Step 1: Bump manifest version (patch)**

**Step 2: Bump package version (patch)**

### Task 5: Package and release

**Files:**
- Create: `SummarizerX-vX.Y.Z.zip`
- Modify: `release-notes/` (if required by existing workflow)

**Step 1: Create zip with project root exclusions**

**Step 2: Create release notes from CHANGELOG entry**

**Step 3: Publish GitHub release with tag `vX.Y.Z`**

### Task 6: Commit and push

**Step 1: Stage doc and version changes**

**Step 2: Commit with conventional message**

**Step 3: Push to `origin/main`**
