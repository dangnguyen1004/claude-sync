# Changelog

## [1.1.0](https://github.com/dangnguyen1004/claude-sync/compare/v1.0.0...v1.1.0) (2026-04-12)


### Features

* **01-01:** implement exclusions module and shared type definitions ([8976121](https://github.com/dangnguyen1004/claude-sync/commit/8976121999d81438d172321ea703436293ccf164))
* **01-01:** scaffold npm package, CLI entry point, and test fixtures ([65d82e6](https://github.com/dangnguyen1004/claude-sync/commit/65d82e6e7ba503033b5fd5f4d40cf183714fb772))
* **01-02:** implement scanner module with streaming checksums ([c0144c3](https://github.com/dangnguyen1004/claude-sync/commit/c0144c32fd7bad4d451e0ac305fd1ad04d77e134))
* **01-04:** wire export command module into CLI ([c595005](https://github.com/dangnguyen1004/claude-sync/commit/c5950058fd0c921e3795ba5b85faa33a8e3a0a34))
* **01-export-03:** implement packer module with createArchive and buildManifest ([e5e6791](https://github.com/dangnguyen1004/claude-sync/commit/e5e67919a2f97277959bb9b1bbd0ca11c93522b2))
* **03-polish:** add secret scanning for API keys and bearer tokens (SEC-01) ([0a24aeb](https://github.com/dangnguyen1004/claude-sync/commit/0a24aeb64e79b40f2161c6d9abc6c97fdc368fee))
* **03-polish:** complete streaming archive, spinners, and secret scanning ([d40e792](https://github.com/dangnguyen1004/claude-sync/commit/d40e792cf7226e52a90911613e1eb7a32ea48d05))
* **03-polish:** wire secret scanning into export flow (SEC-01) ([99b82ae](https://github.com/dangnguyen1004/claude-sync/commit/99b82ae1fac4e18b6d1f410e85c9b24b99dc9476))
* **04:** add CI/CD pipeline for npm publish and GitHub Releases ([259d169](https://github.com/dangnguyen1004/claude-sync/commit/259d169178c261c20fcfadcda6b3ee95cda151e1))
* implement list, unpacker, and restorer modules ([dbdbc3f](https://github.com/dangnguyen1004/claude-sync/commit/dbdbc3fae07840f21bfed19a2742299b377431d3))


### Bug Fixes

* **02-import:** add Wave 0 stub test creation task per checker feedback ([59f8f8d](https://github.com/dangnguyen1004/claude-sync/commit/59f8f8dee165932b5793fb9bd98d4fb0b8ecc20c))
* **ci:** add pull-requests permission and sync lockfile ([7b6917c](https://github.com/dangnguyen1004/claude-sync/commit/7b6917c39d987b6eac51c4307573482607514ed4))
* **ci:** replace node:fs glob with fs/promises readdir for Node 20 compat ([a5c3b50](https://github.com/dangnguyen1004/claude-sync/commit/a5c3b50b406f99e6691f93a48206b57708c9b5c7))
* **ci:** resolve parallel test races and deprecated release action ([7e41e82](https://github.com/dangnguyen1004/claude-sync/commit/7e41e82291ae939aa005c738ff882c2431db6a52))
* **ci:** use npm pack for release archive instead of claude-sync export ([ab3b009](https://github.com/dangnguyen1004/claude-sync/commit/ab3b00944bd256c79c77ff6a4cdad63b086b29ba))

## 1.0.0 (2026-04-12)


### Features

* **01-01:** implement exclusions module and shared type definitions ([8976121](https://github.com/dangnguyen1004/claude-sync/commit/8976121999d81438d172321ea703436293ccf164))
* **01-01:** scaffold npm package, CLI entry point, and test fixtures ([65d82e6](https://github.com/dangnguyen1004/claude-sync/commit/65d82e6e7ba503033b5fd5f4d40cf183714fb772))
* **01-02:** implement scanner module with streaming checksums ([c0144c3](https://github.com/dangnguyen1004/claude-sync/commit/c0144c32fd7bad4d451e0ac305fd1ad04d77e134))
* **01-04:** wire export command module into CLI ([c595005](https://github.com/dangnguyen1004/claude-sync/commit/c5950058fd0c921e3795ba5b85faa33a8e3a0a34))
* **01-export-03:** implement packer module with createArchive and buildManifest ([e5e6791](https://github.com/dangnguyen1004/claude-sync/commit/e5e67919a2f97277959bb9b1bbd0ca11c93522b2))
* **03-polish:** add secret scanning for API keys and bearer tokens (SEC-01) ([0a24aeb](https://github.com/dangnguyen1004/claude-sync/commit/0a24aeb64e79b40f2161c6d9abc6c97fdc368fee))
* **03-polish:** complete streaming archive, spinners, and secret scanning ([d40e792](https://github.com/dangnguyen1004/claude-sync/commit/d40e792cf7226e52a90911613e1eb7a32ea48d05))
* **03-polish:** wire secret scanning into export flow (SEC-01) ([99b82ae](https://github.com/dangnguyen1004/claude-sync/commit/99b82ae1fac4e18b6d1f410e85c9b24b99dc9476))
* **04:** add CI/CD pipeline for npm publish and GitHub Releases ([259d169](https://github.com/dangnguyen1004/claude-sync/commit/259d169178c261c20fcfadcda6b3ee95cda151e1))
* implement list, unpacker, and restorer modules ([dbdbc3f](https://github.com/dangnguyen1004/claude-sync/commit/dbdbc3fae07840f21bfed19a2742299b377431d3))


### Bug Fixes

* **02-import:** add Wave 0 stub test creation task per checker feedback ([59f8f8d](https://github.com/dangnguyen1004/claude-sync/commit/59f8f8dee165932b5793fb9bd98d4fb0b8ecc20c))
* **ci:** add pull-requests permission and sync lockfile ([7b6917c](https://github.com/dangnguyen1004/claude-sync/commit/7b6917c39d987b6eac51c4307573482607514ed4))
* **ci:** resolve parallel test races and deprecated release action ([7e41e82](https://github.com/dangnguyen1004/claude-sync/commit/7e41e82291ae939aa005c738ff882c2431db6a52))
