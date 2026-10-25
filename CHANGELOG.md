# Changelog

## [0.2.0](https://github.com/sovrin/censitas/compare/v0.1.0...v0.2.0) (2026-10-25)


### ⚠ BREAKING CHANGES

* the list of all sites, import and export (and the example sites file) are gone; /api/sites/* moved under /api/p/<id>/sites; the status hook is gone (nexitas shows projectStatus).
* run as a module of nexitas, on its shared projects
* **auth:** sign in with an owner account, as collatas does, instead of basic auth

### Features

* **auth:** sign in with an owner account, as collatas does, instead of basic auth ([ff34e99](https://github.com/sovrin/censitas/commit/ff34e993a111992a5f5843911c24b591a3f5a577))
* **dashboard:** a column chart per event instead of the wide per-day table ([6175f64](https://github.com/sovrin/censitas/commit/6175f6416159ac9312c3b58397c57f97d349806c))
* **dashboard:** daily counts and prop breakdowns per site, behind basic auth ([64cd523](https://github.com/sovrin/censitas/commit/64cd5230a41cfc6ca37d9240469387eab07e6c27))
* **dashboard:** headline figures with trends, chart axes and readouts, share bars ([8fb9c82](https://github.com/sovrin/censitas/commit/8fb9c82a9f03ba4fa234b5ac7ea099e0e5e8a9a1))
* **dashboard:** live updates through server-sent events, as in collatas ([d561f27](https://github.com/sovrin/censitas/commit/d561f2784d143e5181ce03ae8e720025de88cb27))
* **dashboard:** transitions for a new range, form rows and alerts ([af588dc](https://github.com/sovrin/censitas/commit/af588dca71354d1c2af8d3aa2d64605ad54f4d57))
* **ingest:** count allowed events in daily counters from /v1/e ([7b0c213](https://github.com/sovrin/censitas/commit/7b0c21390532b83a7bc5d27e7ba66ca5d2f52fb0))
* one project's usage, under its /p/&lt;id&gt; ([d1c3810](https://github.com/sovrin/censitas/commit/d1c38105ad06ef05f1312ba9c8589a8df649949a))
* run as a module of nexitas, on its shared projects ([d8b0f2b](https://github.com/sovrin/censitas/commit/d8b0f2b774cfd5de425b28fc77dacdb240c73b97))
* **setup:** counting is set up on the Usage page, not the project's overview ([b5cb7e9](https://github.com/sovrin/censitas/commit/b5cb7e9d2efac646cbd87e444a0007d78dec2ab6))
* **sites:** add and edit sites and their allowed events in the dashboard ([f023b2b](https://github.com/sovrin/censitas/commit/f023b2b291f0b7be5d28dd647b87201a343bd208))
* **sites:** clear refused beacons once dealt with ([dd68d2f](https://github.com/sovrin/censitas/commit/dd68d2f28fbd11aa75f55d463574352a59a963f0))
* **sites:** count refused beacons by reason and warn about them ([82d9cb8](https://github.com/sovrin/censitas/commit/82d9cb8627654c4240ade861ac5793c931a922c1))
* **sites:** delete a site's counts and keep the site ([3027f85](https://github.com/sovrin/censitas/commit/3027f854e81b54a9e7dd1bc5ffb356aba7a3b3ca))
* **sites:** import and export site settings as one JSON file ([7eb4014](https://github.com/sovrin/censitas/commit/7eb4014f79a7a3f20fa13d06b5927c322062f80f))
* **sites:** round limits up to powers of two ([a0cd02b](https://github.com/sovrin/censitas/commit/a0cd02b19961099532961fba30109543ae46f739))
* the console's look: a hue, a sidebar figure and the overview's story ([0e22def](https://github.com/sovrin/censitas/commit/0e22def109637998afd6b4fe340604dd32591cda))
* **tracker:** /v1/track.js, a page view on import and track() by beacon ([6bb0b8f](https://github.com/sovrin/censitas/commit/6bb0b8f939b06c7887e5bf94a6d335414bdccc85))


### Bug Fixes

* build on the core's toolkit, in its UI patterns ([eb4cfba](https://github.com/sovrin/censitas/commit/eb4cfba2c1ad50acd6c00322ac55bbc2e33b6d2c))
* check against a fully installed nexitas ([4157855](https://github.com/sovrin/censitas/commit/4157855a5fdf163ce0fe6732f168a350f8c6607c))
* check against a fully installed nexitas ([6c9de3b](https://github.com/sovrin/censitas/commit/6c9de3be99b103731e5ef1c66c7ff43397b2da0d))
* **dashboard:** refusals as a quiet link to the end of the page, whole-count chart ticks ([fc18086](https://github.com/sovrin/censitas/commit/fc18086e171f28b08df4f9860a6077cdfb0106b2))
* draw every page with the core's page kit ([924399b](https://github.com/sovrin/censitas/commit/924399b0e491e9a030867536fb1be5408e287b8f))
* **ingest:** answer refused beacons with their status, not a redirect to sign in ([0793474](https://github.com/sovrin/censitas/commit/0793474ed61b9322cca183dd0304c5f0f3fb6bd0))
* refused counts follow the usage sections' rhythm ([70b11e3](https://github.com/sovrin/censitas/commit/70b11e3ce805694ce6e5de486f2ebd3653eeb636))
* **security:** open exactly the sign-in routes, and read-only CI ([81f94ba](https://github.com/sovrin/censitas/commit/81f94ba47d5609914c7c48943b4d6b82398307af))
* **sites:** leave refusals off the sites list ([d9f8b89](https://github.com/sovrin/censitas/commit/d9f8b89295509e7153a822f0239082a742438f5c))
* the overview panel is the tracker, and the sidebar counts a week ([23a35ee](https://github.com/sovrin/censitas/commit/23a35ee6ab04240aa413ed412ec5c3b0d7e326db))
