# @onlyoffice/n8n-nodes-docs

This is an n8n community node package for [ONLYOFFICE Document Server](https://www.onlyoffice.com/office-suite.aspx) (Docs).

It provides nodes to interact with the ONLYOFFICE Document Server API:

- **Conversion API** — convert documents between formats (docx → pdf, xlsx → csv, etc.)
- **Document Builder** — generate documents from scripts (coming soon)

## Prerequisites

- An n8n instance (self-hosted or cloud)
- Access to an ONLYOFFICE Document Server instance with JWT enabled

## Installation

### In n8n (Community Nodes)

1. Go to **Settings** → **Community Nodes**
2. Select **Install**
3. Enter `@onlyoffice/n8n-nodes-docs`
4. Agree to the risks and click **Install**

### Manual Installation

```bash
cd ~/.n8n/nodes
npm install @onlyoffice/n8n-nodes-docs
```

## Credentials

The node uses JWT-based authentication. You need:

| Field | Description |
|-------|-------------|
| **Document Server URL** | Base URL of your Document Server (e.g. `https://docs.example.com`) |
| **JWT Secret** | The secret key configured on your Document Server |
| **JWT Header** | HTTP header for JWT token (default: `Authorization`) |

## Nodes

### ONLYOFFICE Docs

#### Conversion → Convert Document

Converts a file from one format to another using the Document Server Conversion API.

**Parameters:**
- **File URL** — URL of the source file (Document Server downloads it)
- **Input Format** — format of the source file
- **Output Format** — desired output format
- **Output File Name** — name for the converted file (without extension)

**Output:** binary data with the converted file + JSON metadata.

## Compatibility

- n8n version 1.0+
- ONLYOFFICE Document Server 7.0+

## Resources

- [ONLYOFFICE Conversion API](https://api.onlyoffice.com/docs/docs-api/additional-api/conversion-api/)
- [ONLYOFFICE Document Builder API](https://api.onlyoffice.com/docs/docs-api/additional-api/document-builder-api/)
- [n8n Community Nodes](https://docs.n8n.io/integrations/community-nodes/)

## License

[MIT](LICENSE)
