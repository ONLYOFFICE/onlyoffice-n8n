# Tests

```bash
pnpm test               # unit tests, no services needed
bash test/docker.sh     # everything in Docker, the same way as CI
```

- `test/unit` — the node with a fake n8n context and a fake Document Server. `helpers.ts` resolves
  parameter defaults from the node description like n8n does, so reading a hidden parameter fails,
  and runs Document Builder scripts against recording stubs to check that user input stays data.
- `test/automation` — one workflow per operation in `workflows/`, executed by a real n8n against a
  real Document Server. `setup.ts` installs the packed package into a temporary n8n folder, serves
  `test/fixtures` for the Document Server and imports the credential and the workflows.
- `test/run.sh` — installs pnpm and n8n, runs the unit tests, builds the package and runs the
  automation tests. CI (`.github/workflows/test.yml`) and `test/docker.sh` both run it.

`DS_IMAGE` selects the Document Server image for `test/docker.sh`, e.g.
`DS_IMAGE=onlyoffice/documentserver-de:9.4.1`. Fixtures are regenerated with `python test/fixtures/generate.py`.
