# ONLYOFFICE Docs n8n Nodes

[![npm version](https://img.shields.io/npm/v/@onlyoffice/n8n-nodes-docs.svg)](https://www.npmjs.com/package/@onlyoffice/n8n-nodes-docs)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/onlyoffice/onlyoffice-n8n/blob/master/LICENSE)

This is an n8n community node that lets you use [ONLYOFFICE Document Server] in your n8n workflows.

ONLYOFFICE Document Server is a powerful document processing and conversion platform that allows you to work with office documents in various formats.

[n8n] is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

### Community nodes (recommended)

1. Go to **Settings > Community Nodes** in your n8n instance
2. Select **Install**
3. Enter `@onlyoffice/n8n-nodes-docs` in **Enter npm package name**
4. Agree to the [risks](https://docs.n8n.io/integrations/community-nodes/risks/) of using community nodes
5. Select **Install**

After installing the node, you can use it like any other node. n8n displays the node in search results in the **Nodes** panel.

### Manual installation

To get started install the package in your n8n root directory:

```bash
npm install @onlyoffice/n8n-nodes-docs
```

For Docker-based deployments add the following line before the font installation command in your [n8n Dockerfile]:

```dockerfile
RUN cd /usr/local/lib/node_modules/n8n && npm install @onlyoffice/n8n-nodes-docs
```

## Nodes

This package provides the following nodes:

- **ONLYOFFICE Docs**: Interact with ONLYOFFICE Document Server API

## Operations

The ONLYOFFICE Docs node supports the following operations:

### Document conversion operations
- Convert a document
- Convert to PDF
- Convert spreadsheet to PDF
- Generate thumbnail
- Remove password
- Add watermark

### Supported formats
The node supports conversion between 50+ formats including:
- **Documents**: DOCX, DOC, ODT, RTF, TXT, PDF, HTML, EPUB
- **Spreadsheets**: XLSX, XLS, ODS, CSV, PDF
- **Presentations**: PPTX, PPT, ODP, PDF
- **Images**: PNG, JPG, JPEG, SVG, BMP

## Credentials

This node supports JWT-based authentication:

| Field                     | Description                                                           |
|---------------------------|-----------------------------------------------------------------------|
| **Document Server URL**   | Base URL of your Document Server (e.g. `https://docs.example.com`)    |
| **JWT Secret**            | The secret key configured on your Document Server                     |
| **JWT Header**            | HTTP header for JWT token (default: `Authorization`)                  |

## Operation Details

### Convert Document
Converts files between different formats with comprehensive format support.

**Parameters:**
- **File URL** — URL of the source file
- **Input Format** — format of the source file
- **Output Format** — desired output format
- **Output File Name** — name for the converted file

### Convert to PDF
Quick conversion to PDF format for supported document types.

### Convert Spreadsheet to PDF
Advanced spreadsheet conversion with layout options:
- Page orientation (portrait/landscape)
- Custom margins and page size
- Scale and zoom settings
- Grid lines and headings display
- Print area handling

### Generate Thumbnail
Create thumbnail images from documents:
- Multiple output formats (PNG, JPG)
- Custom dimensions
- Aspect ratio handling
- Single page or multi-page output

### Remove Password
Remove password protection from password-protected documents.

### Add Watermark
Convert to PDF with customizable text watermarks:
- Custom text content
- Font styling (size, color, bold)
- Positioning (diagonal/horizontal)
- Transparency control

## License

The ONLYOFFICE Docs n8n Nodes are distributed under the MIT license. See [LICENSE] for more information.

## Versions

See [CHANGELOG.md] for version history and release notes.

## Useful links & support

| Resource                      | URL                                                                    |
|-------------------------------|------------------------------------------------------------------------|
| ONLYOFFICE website            | [onlyoffice.com](https://www.onlyoffice.com)                           |
| ONLYOFFICE Document Server    | [onlyoffice.com/docs](https://www.onlyoffice.com/docs)                 |
| n8n community nodes documentation | [docs.n8n.io](https://docs.n8n.io/integrations/community-nodes/)   |
| API documentation             | [api.onlyoffice.com](https://api.onlyoffice.com/docs/)                 |
| Community forum               | [community.onlyoffice.com](https://community.onlyoffice.com/)          |
| Help Center                   | [helpcenter.onlyoffice.com](https://helpcenter.onlyoffice.com/)        |
| Found a bug?                  | [Report an issue](https://github.com/ONLYOFFICE/onlyoffice-n8n/issues) |
| Support email                 | [support@onlyoffice.com](mailto:support@onlyoffice.com)                |

<p align="center">Made with ❤️ by the ONLYOFFICE Team</p>

<!-- Definitions -->

[n8n]: https://n8n.io/
[ONLYOFFICE Document Server]: https://www.onlyoffice.com/docs
[n8n Dockerfile]: https://github.com/n8n-io/n8n/blob/master/docker/images/n8n/Dockerfile
[LICENSE]: https://github.com/onlyoffice/onlyoffice-n8n/blob/master/LICENSE
[CHANGELOG.md]: https://github.com/onlyoffice/onlyoffice-n8n/blob/master/CHANGELOG.md
